import { styleRegistry } from '@static-styled-plugin/style-registry'
import * as TS from 'typescript'
import {
  ArrowFunction,
  BinaryExpression,
  BindingElement,
  Identifier,
  Node,
  PropertyAccessExpression,
  SourceFile,
  TemplateExpression,
  TemplateLiteral
} from 'ts-morph'
import { evaluate, IEnvironment } from 'ts-evaluator'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { Theme } from './types'

export const TsEvalError = Symbol('EvalError')
type EvaluateExtra = IEnvironment['extra']

export function compileStyledFunction(file: SourceFile, styledFunctionName: string, theme: Theme | null) {
  file.forEachDescendant((node) => {
    if (!Node.isTaggedTemplateExpression(node)) return

    const tagName = getTagName(node.getTag(), styledFunctionName)
    if (!tagName || !isHTMLTag(tagName)) return

    const result = evaluateTaggedTemplateLiteral(node.getTemplate(), theme)
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

function evaluateTaggedTemplateLiteral(template: TemplateLiteral, theme: Theme | null) {
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
      const value = evaluateInterpolation(templateSpanExpression, {}, theme)
      if (value === TsEvalError) return TsEvalError
      result += (value + templateMiddle)
    }
  }
  return result
}

export function evaluateInterpolation(node: Node, extra: EvaluateExtra, theme?: Theme | null, ts?: typeof TS) {
  if (Node.isStringLiteral(node) || Node.isNumericLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue()
  } else if (Node.isBinaryExpression(node)) {
    // e.g. width * 2
    return evaluateBinaryExpression(node, extra, ts)
  } else if (Node.isPropertyAccessExpression(node)) {
    // e.g. theme.fontSize.m
    return evaluatePropertyAccessExpression(node, extra, ts)
  } else if (Node.isIdentifier(node)) {
    // e.g. width
    return evaluateIdentifier(node, extra, ts)
  } else if (Node.isTemplateExpression(node)) {
    // e.g. `${fontSize.m}px`
    return evaluateTemplateExpression(node, extra, ts)
  } else if (Node.isArrowFunction(node)) {
    // e.g. (props) => props.fontSize.m
    return evaluateArrowFunction(node, extra, theme, ts)
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
export function evaluateBinaryExpression(node: BinaryExpression, extra: EvaluateExtra, ts?: typeof TS): string | number | typeof TsEvalError {
  /* first, evaluate each item of binary expressions, and then evaluate the whole node */
  const items = flattenBinaryExpressions(node)
  for (const item of items) {
    const value = evaluateInterpolation(item, extra, undefined, ts)
    if (value === TsEvalError) return TsEvalError
    item.replaceWithText(typeof value === 'string' ? `'${value}'` : String(value))
  }

  const evaluated = evaluate({
    node: node.compilerNode,
    typescript: ts,
    environment: { extra }
  })
  if (evaluated.success) {
    const value = evaluated.value
    if (typeof value === 'string' || typeof value === 'number') return value
  }
  return TsEvalError
}

export function evaluatePropertyAccessExpression(node: PropertyAccessExpression, extra: EvaluateExtra, ts?: typeof TS): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isPropertyAssignment(nodeParent)) continue
    const propertyInitializer = nodeParent.getInitializer()
    if (!propertyInitializer) continue
    const evaluated = evaluate({
      node: propertyInitializer.compilerNode,
      typescript: ts,
      environment: { extra }
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: ts,
      environment: { extra }
    })
    if (evaluated.success) {
      value = evaluated.value
    }
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

export function evaluateIdentifier(node: Identifier, extra: EvaluateExtra, ts?: typeof TS): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isVariableDeclaration(nodeParent)) continue

    const evaluated = evaluate({
      node: nodeParent.compilerNode,
      typescript: ts,
      environment: { extra }
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (!value && extra) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: ts,
      environment: { extra }
    })
    if (evaluated.success) {
      value = evaluated.value
    }
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

export function evaluateTemplateExpression(node: TemplateExpression, extra: EvaluateExtra, ts?: typeof TS): string | typeof TsEvalError {
  let result = node.getHead().getLiteralText()
  const templateSpans = node.getTemplateSpans()

  for (let i = 0; i < templateSpans.length; i++) {
    const templateSpan = templateSpans[i]
    const templateMiddle = templateSpan.getLiteral().getLiteralText()
    const templateSpanExpression = templateSpan.getExpression()
    const value = evaluateInterpolation(templateSpanExpression, extra, undefined, ts)
    if (value === TsEvalError) return TsEvalError
    result += (value + templateMiddle)
  }

  return result
}

export function evaluateArrowFunction(node: ArrowFunction, extra: EvaluateExtra, theme?: Theme | null, ts?: typeof TS): string | number | typeof TsEvalError {
  const body = node.getBody()
  if (Node.isBinaryExpression(body) || Node.isIdentifier(body) || Node.isPropertyAccessExpression(body) || Node.isTemplateExpression(body)) {
    // when function merely returns property access expression like `props.theme.fontSize.m`
    const parent = body.getParent()
    if (Node.isArrowFunction(parent)) {
      const parameters = parent.getParameters()
      const firstParameter = parameters[0]?.getNameNode()
      if (Node.isIdentifier(firstParameter)) {
        // (props) => ...
        extra = {
          [firstParameter.getFullText()]: { theme }
        }
      } else if (Node.isObjectBindingPattern(firstParameter)) {
        // ({ theme }) => ...
        // ({ theme: myTheme }) => ...
        // ({ theme: { fontSize } }) => ...
        const bindingElements = firstParameter.getElements()
        if (theme) {
          extra = recursivelyBuildExtraBasedOnTheme(bindingElements, {
            theme
          })
        }
      }
    }
  } else if (Node.isBlock(body)) {
    // TODO: support block
  }
  return evaluateInterpolation(body, extra, undefined, ts)
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
