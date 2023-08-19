import { styleRegistry } from '@static-styled-plugin/style-registry'
import {
  ArrowFunction,
  Expression,
  Identifier,
  Node,
  PropertyAccessExpression,
  SourceFile,
  TemplateLiteral
} from 'ts-morph'
import { evaluate } from 'ts-evaluator'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { Theme } from './types'

const TsEvalError = Symbol('EvalError')

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
      const value = evaluateInterpolation(templateSpanExpression, theme)
      if (value === TsEvalError) return TsEvalError
      result += (value + templateMiddle)
    }
  }
  return result
}

function evaluateInterpolation(node: Expression, theme: Theme | null) {
  if (Node.isStringLiteral(node) || Node.isNumericLiteral(node)) {
    return node.getLiteralValue()
  } else if (Node.isPropertyAccessExpression(node)) {
    /* pattern like the following */
    // const constants = { width: 20 }
    // const Box = styled.div`
    //   width: ${constants.width}px;
    // `
    return evaluatePropertyAccessExpression(node)
  } else if (Node.isIdentifier(node)) {
    /* pattern like the following */
    // const width = 20
    // const Box = styled.div`
    //   width: ${width}px;
    // `
    return evaluateIdentifier(node)
  } else if (Node.isArrowFunction(node)) {
    /* pattern like the following */
    // const Text = styled.p`
    //   fontSize: ${(props) => props.fontSize.m}px;
    // `
    return evaluateArrowFunction(node, theme)
  } else {
    return TsEvalError
  }
}

function evaluatePropertyAccessExpression(node: PropertyAccessExpression): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isPropertyAssignment(nodeParent)) continue
    const propertyInitializer = nodeParent.getInitializer()
    if (!propertyInitializer) continue
    const evaluated = evaluate({
      node: propertyInitializer.compilerNode
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

function evaluateIdentifier(node: Identifier): string | number | typeof TsEvalError {
  let value: unknown
  const referencesAsNode = node.findReferencesAsNodes()

  for (const node of referencesAsNode) {
    const nodeParent = node.getParentOrThrow()
    if (!Node.isVariableDeclaration(nodeParent)) continue
    const evaluated = evaluate({
      node: nodeParent.compilerNode
    })
    if (!evaluated.success) continue
    value = evaluated.value
  }

  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}

function evaluateArrowFunction(node: ArrowFunction, theme: Theme | null): string | number | typeof TsEvalError {
  const evaluated = evaluate({
    node: node.getBody().compilerNode as any,
    environment: {
      extra: {
        props: { theme },
        theme: theme
      }
    }
  })
  if (!evaluated.success) return TsEvalError
  const value = evaluated.value
  if (typeof value === 'string' || typeof value === 'number') return value
  return TsEvalError
}
