import { styleRegistry } from '@static-styled-plugin/style-registry'
import * as TS from 'typescript'
import {
  ArrowFunction,
  BinaryExpression,
  BindingElement,
  BindingName,
  Identifier,
  Node,
  PropertyAccessExpression,
  ReturnStatement,
  SourceFile,
  TaggedTemplateExpression,
  TemplateExpression,
} from 'ts-morph'
import { evaluate, IEnvironment } from 'ts-evaluator'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { Theme } from './types'

export const TsEvalError = Symbol('EvalError')
type EvaluateExtra = IEnvironment['extra']

export function compileStyledFunction(file: SourceFile, styledFunctionName: string, cssFunctionName: string | null, theme: Theme | null) {
  file.forEachDescendant((node) => {
    if (!Node.isTaggedTemplateExpression(node)) return

    const tagName = getTagName(node.getTag(), styledFunctionName)
    if (!tagName || !isHTMLTag(tagName)) return

    const result = evaluateTaggedTemplateExpression(node, {}, { cssFunctionName }, theme)
    if (result === TsEvalError) return

    const cssString = result.replace(/\s+/g, ' ').trim()
    const classNameHash = generateHash(cssString)
    const className = `static-styled-${classNameHash}`
    styleRegistry.addRule(classNameHash, cssString)

    node.replaceWithText(`
    (props: any) => {
      const inheritedClassName = props.className ?? '';
      const joinedClassName = \`\${inheritedClassName} ${className}\`.trim();
      return <${tagName} { ...props } className={joinedClassName} />;
    }
  `)
  })
}

function getTagName(tag: Node, styledFunctionName: string) {
  let tagName: string | null = null
  if (/* e.g. styled('p') */ Node.isCallExpression(tag) && tag.compilerNode.expression.getText() === styledFunctionName) {
    const arg = tag.getArguments()[0]
    tagName = Node.isStringLiteral(arg) ? arg.getLiteralValue() : null
  } else if (/* e.g. styled.p */ Node.isPropertyAccessExpression(tag) && tag.compilerNode.expression.getText() === styledFunctionName) {
    tagName = tag.compilerNode.name.getText() ?? null
  }
  return tagName
}

type Definition = {
  ts?: typeof TS
  cssFunctionName: string | null
}

export function evaluateInterpolation(node: Node, extra: EvaluateExtra, definition: Definition, theme: Theme | null) {
  if (Node.isStringLiteral(node) || Node.isNumericLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue()
  } else if (Node.isBinaryExpression(node)) {
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
  } else {
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
export function evaluateBinaryExpression(node: BinaryExpression, extra: EvaluateExtra, definition: Definition): string | number | typeof TsEvalError {
  /* first, evaluate each item of binary expressions, and then evaluate the whole node */
  const items = flattenBinaryExpressions(node)
  for (const item of items) {
    const value = evaluateInterpolation(item, extra, definition, null)
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

export function evaluatePropertyAccessExpression(node: PropertyAccessExpression, extra: EvaluateExtra, definition: Definition): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isPropertyAssignment(nodeParent)) continue
    const propertyInitializer = nodeParent.getInitializer()
    if (!propertyInitializer) continue
    const evaluated = evaluate({
      node: propertyInitializer.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (evaluated.success) {
      value = evaluated.value
    }
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

export function evaluateIdentifier(node: Identifier, extra: EvaluateExtra, definition: Definition): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isVariableDeclaration(nodeParent)) continue

    const evaluated = evaluate({
      node: nodeParent.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: definition.ts,
      environment: { extra }
    })
    if (evaluated.success) {
      value = evaluated.value
    }
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

export function evaluateTemplateExpression(node: TemplateExpression, extra: EvaluateExtra, definition: Definition): string | typeof TsEvalError {
  let result = node.getHead().getLiteralText()
  const templateSpans = node.getTemplateSpans()

  for (let i = 0; i < templateSpans.length; i++) {
    const templateSpan = templateSpans[i]
    const templateMiddle = templateSpan.getLiteral().getLiteralText()
    const templateSpanExpression = templateSpan.getExpression()
    const value = evaluateInterpolation(templateSpanExpression, extra, definition, null)
    if (value === TsEvalError) return TsEvalError
    result += (value + templateMiddle)
  }

  return result
}

function evaluateTaggedTemplateExpression(node: TaggedTemplateExpression, extra: EvaluateExtra, definition: Definition, theme: Theme | null): string | typeof TsEvalError {
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
      const value = evaluateInterpolation(templateSpanExpression, extra, definition, theme)
      if (value === TsEvalError) return TsEvalError
      result += (value + templateMiddle)
    }
  }
  return result
}

export function evaluateArrowFunction(node: ArrowFunction, extra: EvaluateExtra, definition: Definition, theme: Theme | null): string | number | typeof TsEvalError {
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
    return evaluateInterpolation(expression, extra, definition, theme)
  } else {
    return evaluateInterpolation(body, extra, definition, theme)
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
