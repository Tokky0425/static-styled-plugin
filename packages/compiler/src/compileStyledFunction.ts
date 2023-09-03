import { styleRegistry } from '@static-styled-plugin/style-registry'
import * as TS from 'typescript'
import {
  ArrowFunction,
  BinaryExpression,
  BindingElement,
  BindingName,
  Identifier,
  Node,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  ReturnStatement,
  SourceFile,
  TaggedTemplateExpression,
  TemplateExpression,
} from 'ts-morph'
import { evaluate, IEnvironment } from 'ts-evaluator'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { compileCssString } from './compileCssString'
import { Theme } from './types'

export const TsEvalError = Symbol('EvalError')
type EvaluateExtra = IEnvironment['extra']

export function compileStyledFunction(file: SourceFile, styledFunctionName: string, cssFunctionName: string | null, theme: Theme | null) {
  file.forEachDescendant((node) => {
    if (!Node.isTaggedTemplateExpression(node)) return

    const tagNode = node.getTag()
    const tagName = getTagName(tagNode, styledFunctionName)
    const attrsArr = getAttrs(tagNode)
    if (!tagName || !isHTMLTag(tagName)) return

    const result = evaluateTaggedTemplateExpression(node, {}, { cssFunctionName }, theme)
    if (result === TsEvalError) return

    const cssString = result.replace(/\s+/g, ' ').trim()
    const classNameHash = generateHash(cssString)
    const className = `static-styled-${classNameHash}`
    const compiledCssString = compileCssString(cssString, className)
    styleRegistry.addRule(classNameHash, compiledCssString)

    const attrsDeclaration = attrsArr.map((attrs, index) => `const attrs${index} = ${attrs.text}`).join('\n')
    const attrsProps = attrsArr.map((attrs, index) => {
      switch (attrs.nodeKindName) {
        case 'ArrowFunction':
          return `...attrs${index}(props)`
        case 'ObjectLiteralExpression':
          return `...attrs${index}`
        default:
          const neverValue: never = attrs.nodeKindName
          throw new Error(`${neverValue}`)

      }
    }).join(', ')

    node.replaceWithText(`
    (props: any) => {
      ${attrsDeclaration}
      const attrsProps = { ${attrsProps} }
      const propsWithAttrs = { ...props, ...attrsProps }
      const joinedClassName = ['${className}', attrsProps.className, props.className].filter(Boolean).join(' ')
      return <${tagName} { ...propsWithAttrs } className={joinedClassName} />;
    }
  `)
  })
}

export function getTagName(node: Node, styledFunctionName: string): string | null {
  let tagName: string | null = null
  if (/* e.g. styled('p') */ Node.isCallExpression(node) && node.compilerNode.expression.getText() === styledFunctionName) {
    const arg = node.getArguments()[0]
    tagName = Node.isStringLiteral(arg) ? arg.getLiteralValue() : null
  } else if (/* e.g. styled.p */ Node.isPropertyAccessExpression(node) && node.compilerNode.expression.getText() === styledFunctionName) {
    tagName = node.compilerNode.name.getText() ?? null
  } else if (Node.isCallExpression(node) || Node.isPropertyAccessExpression(node)) {
    // for when .attrs is used
    const expression = node.getExpression()
    if (Node.isCallExpression(expression) || Node.isPropertyAccessExpression(expression)) {
      tagName = getTagName(expression, styledFunctionName)
    }
  }
  return tagName
}

type GetAttrsResult = {
  nodeKindName: 'ArrowFunction' | 'ObjectLiteralExpression',
  text: string,
}

export function getAttrs(node: Node): GetAttrsResult[] {
  let result: GetAttrsResult[] = []

  if (!Node.isCallExpression(node)) return result
  const expression = node.getExpression()
  if (!(Node.isPropertyAccessExpression(expression) && expression.getName() === 'attrs')) return result

  // recursively call getAttrs because attrs can be chained
  // e.g. const Text = styled.p.attrs().attrs()``
  const nextExpression = expression.getExpression()
  const nextExpressionResult = getAttrs(nextExpression)
  if (nextExpressionResult) {
    result = [...nextExpressionResult]
  }

  const argument = node.getArguments()[0]
  if (Node.isArrowFunction(argument)) {
    return [...result, {
      nodeKindName: 'ArrowFunction' as const,
      text: argument.getFullText()
    }]
  } else if (Node.isObjectLiteralExpression(argument)) {
    return [...result, {
      nodeKindName: 'ObjectLiteralExpression' as const,
      text: argument.getFullText()
    }]
  } else {
    throw new Error('unexpected expression for attrs')
  }
}

type Definition = {
  ts?: typeof TS
  cssFunctionName: string | null
}

type ErrorType = typeof TsEvalError
type PrimitiveType = string | number
type ObjectType = { [key: string]: (PrimitiveType | ObjectType) }

export function evaluateSyntax(node: Node, extra: EvaluateExtra, definition: Definition, theme: Theme | null): PrimitiveType | ObjectType | ErrorType {
  if (Node.isBinaryExpression(node)) {
    // e.g. width * 2
    return evaluateBinaryExpression(node, extra, definition)
  } else if (Node.isPropertyAccessExpression(node)) {
    // e.g. theme.fontSize.m
    return evaluatePropertyAccessExpression(node, extra, definition)
  } else if (Node.isIdentifier(node)) {
    // e.g. width
    return evaluateIdentifier(node, extra, definition)
  } else if (Node.isTemplateExpression(node)) {
    // e.g. `${fontSize.m}px`
    return evaluateTemplateExpression(node, extra, definition)
  } else if (Node.isTaggedTemplateExpression(node) && definition.cssFunctionName && node.getTag().getFullText() === definition.cssFunctionName) {
    // e.g. css`
    //   font-size: 16rem;
    // `
    return evaluateTaggedTemplateExpression(node, extra, definition, theme)
  } else if (Node.isArrowFunction(node)) {
    // e.g. (props) => props.fontSize.m
    return evaluateArrowFunction(node, extra, definition, theme)
  } else if (Node.isObjectLiteralExpression(node)) {
    // for when parsing theme
    return evaluateObjectLiteralExpression(node, extra, definition, theme)
  } else {
    const evaluated = evaluate({
      node: node.compilerNode as any,
      typescript: definition.ts,
      environment: { extra }
    })
    if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number')) {
      return evaluated.value
    }
    return TsEvalError
  }
}

function flattenBinaryExpressions(node: BinaryExpression): Node[] {
  const left = node.getLeft()
  const right = node.getRight()
  if (Node.isBinaryExpression(left)) {
    return [...flattenBinaryExpressions(left), right]
  } else {
    return [left, right]
  }
}
function evaluateBinaryExpression(node: BinaryExpression, extra: EvaluateExtra, definition: Definition): PrimitiveType | ErrorType {
  /* first, evaluate each item of binary expressions, and then evaluate the whole node */
  const items = flattenBinaryExpressions(node)
  for (const item of items) {
    const value = evaluateSyntax(item, extra, definition, null)
    if (value === TsEvalError) return TsEvalError
    item.replaceWithText(typeof value === 'string' ? `'${value}'` : String(value))
  }

  const evaluated = evaluate({
    node: node.compilerNode,
    typescript: definition.ts,
    environment: { extra }
  })
  if (evaluated.success) {
    const value = evaluated.value
    if (typeof value === 'string' || typeof value === 'number') return value
  }
  return TsEvalError
}

function evaluatePropertyAccessExpression(node: PropertyAccessExpression, extra: EvaluateExtra, definition: Definition): PrimitiveType | ObjectType | ErrorType {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isPropertyAssignment(nodeParent)) continue
    const propertyInitializer = nodeParent.getInitializer()
    if (!propertyInitializer) continue
    const propertyInitializerValue = evaluateSyntax(propertyInitializer, extra, definition, null)
    if (propertyInitializerValue === TsEvalError) return TsEvalError
    value = propertyInitializerValue
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number' || typeof evaluated.value === 'object')) {
      value = evaluated.value
    }
  }

  return (value as PrimitiveType | ObjectType) || TsEvalError
}

function evaluateIdentifier(node: Identifier, extra: EvaluateExtra, definition: Definition): PrimitiveType | ObjectType | ErrorType {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isVariableDeclaration(nodeParent)) continue
    const propertyInitializerValue = evaluateSyntax(nodeParent, extra, definition, null)
    if (propertyInitializerValue === TsEvalError) return TsEvalError
    value = propertyInitializerValue
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number' || typeof evaluated.value === 'object')) {
      value = evaluated.value
    }
  }

  return (value as PrimitiveType | ObjectType) || TsEvalError
}

function evaluateTemplateExpression(node: TemplateExpression, extra: EvaluateExtra, definition: Definition): string | ErrorType {
  let result = node.getHead().getLiteralText()
  const templateSpans = node.getTemplateSpans()

  for (let i = 0; i < templateSpans.length; i++) {
    const templateSpan = templateSpans[i]
    const templateMiddle = templateSpan.getLiteral().getLiteralText()
    const templateSpanExpression = templateSpan.getExpression()
    const value = evaluateSyntax(templateSpanExpression, extra, definition, null)
    if (value === TsEvalError) return TsEvalError
    result += (value + templateMiddle)
  }

  return result
}

function evaluateTaggedTemplateExpression(node: TaggedTemplateExpression, extra: EvaluateExtra, definition: Definition, theme: Theme | null): string | ErrorType {
  const template = node.getTemplate()
  let result = ''

  if (Node.isNoSubstitutionTemplateLiteral(template)) {
    result = template.getLiteralText()
  } else {
    result = template.getHead().getLiteralText()
    const templateSpans = template.getTemplateSpans()

    for (let i = 0; i < templateSpans.length; i++) {
      const templateSpan = templateSpans[i]
      const templateMiddle = templateSpan.getLiteral().getLiteralText()
      const templateSpanExpression = templateSpan.getExpression()
      const value = evaluateSyntax(templateSpanExpression, extra, definition, theme)
      if (value === TsEvalError) return TsEvalError
      result += (value + templateMiddle)
    }
  }
  return result
}

function evaluateArrowFunction(node: ArrowFunction, extra: EvaluateExtra, definition: Definition, theme: Theme | null): PrimitiveType | ObjectType | ErrorType {
  const body = node.getBody()
  // `getAllAncestorParams` searches parent nodes recursively and get all arrow functions' first parameter.
  // We do this because arrow functions can be nested (e.g. `(props) => ({ theme }) => ...`) and we need to know from which arrow function the arg comes.
  const params = getAllAncestorParams(body)
  params.forEach((param) => {
    if (Node.isIdentifier(param)) {
      // (props) => ...
      extra = {
        [param.getFullText()]: { theme },
        ...extra, // to prioritize descendant's args, ...extra should come at last
      }
    } else if (Node.isObjectBindingPattern(param)) {
      // ({ theme }) => ...
      // ({ theme: myTheme }) => ...
      // ({ theme: { fontSize } }) => ...
      const bindingElements = param.getElements()
      if (theme) {
        extra = {
          ...recursivelyBuildExtraBasedOnTheme(bindingElements, {
            theme
          }),
          ...extra, // to prioritize descendant's args, ...extra should come at last
        }
      }
    }
  })

  if (Node.isBlock(body)) {
    const returnStatements = body.getStatements().filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
    if (returnStatements.length !== 1) return TsEvalError // because conditional return is not supported
    const expression = returnStatements[0].getExpression()
    if (!expression) return TsEvalError
    return evaluateSyntax(expression, extra, definition, theme)
  } else {
    return evaluateSyntax(body, extra, definition, theme)
  }
}

function getAllAncestorParams(node: Node, params: BindingName[] = []) {
  const parent = node.getParent()
  if (!parent) return params
  if (Node.isArrowFunction(parent)) {
    const parameters = parent.getParameters()
    const firstParameter = parameters[0]?.getNameNode()
    firstParameter && params.push(firstParameter)
  }
  return getAllAncestorParams(parent, params)
}

function recursivelyBuildExtraBasedOnTheme(bindingElements: BindingElement[], themeFragment: Theme, extra: EvaluateExtra = {}): EvaluateExtra {
  for (const bindingElement of bindingElements) {
    const name = bindingElement.getNameNode()
    const propertyName = bindingElement.getPropertyNameNode()
    if (Node.isIdentifier(name)) {
      /**
       * just destructure: `({ theme }) => ...`
       * or
       * destructure and rename: `({ theme: myTheme }) => ...`
       */
      const keyForExtra = name.getText() // 'theme' when Identifier, 'myTheme' when ObjectBindingPattern
      const keyForTheme = propertyName?.getText() ?? keyForExtra // propertyName.getText() returns 'theme' when ObjectBindingPattern
      const value = themeFragment[keyForTheme]
      if (value) {
        extra[keyForExtra] = value
      }
    } else if (Node.isObjectBindingPattern(name)) {
      /**
       * ({ theme: { fontSize } }) => ...
       */
      const keyForExtra = propertyName?.getText() // 'theme'
      if (!keyForExtra) continue // not sure if this possibly happens
      const newThemeFragment = themeFragment[keyForExtra]
      if (!newThemeFragment || typeof newThemeFragment === 'string' || typeof newThemeFragment === 'number') continue
      recursivelyBuildExtraBasedOnTheme(name.getElements(), newThemeFragment, extra)
    }
  }
  return extra
}

export function evaluateObjectLiteralExpression(node: ObjectLiteralExpression, extra: EvaluateExtra, definition: Definition, theme: Theme | null): PrimitiveType | ObjectType | ErrorType {
  const properties = node.getProperties()

  for (const property of properties) {
    if (!Node.isPropertyAssignment(property)) continue
    const initializer = property.getInitializer()
    if (!initializer) continue
    if (Node.isObjectLiteralExpression(initializer)) {
      evaluateObjectLiteralExpression(initializer, extra, definition, theme)
    } else if (initializer) {
      const result = evaluateSyntax(initializer, extra, definition, theme)
      if (result === TsEvalError) return TsEvalError
      initializer.replaceWithText(JSON.stringify(result))
    }
  }

  const evaluated = evaluate({
    node: node.compilerNode,
    typescript: definition.ts,
    environment: { extra }
  })

  if (evaluated.success && typeof evaluated.value === 'object') {
    return evaluated.value as ObjectType
  }
  return TsEvalError
}
