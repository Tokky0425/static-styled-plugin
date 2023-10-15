import { styleRegistry } from '@static-styled-plugin/style-registry'
import { Node, SourceFile } from 'ts-morph'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { compileCssString } from './compileCssString'
import { Theme } from './types'
import { Evaluator, TsEvalError } from './Evaluator'

export function compileStyledFunction(file: SourceFile, styledFunctionName: string, cssFunctionName: string | null, theme: Theme | null) {
  let shouldUseClient = false
  file.forEachDescendant((node) => {
    if (!Node.isTaggedTemplateExpression(node)) return

    const tagNode = node.getTag()
    const tagName = getTagName(tagNode, styledFunctionName)
    const attrsArr = getAttrs(tagNode)
    if (!tagName || !isHTMLTag(tagName)) {
      shouldUseClient = true
      return
    }

    const evaluator = new Evaluator({ extra: {}, definition: { cssFunctionName }, theme })
    const result = evaluator.evaluateStyledTaggedTemplateExpression(node)
    if (result === TsEvalError) {
      shouldUseClient = true
      return
    }

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
      const attrsProps = { ${attrsProps} } as any
      const propsWithAttrs = { ...props, ...attrsProps } as any
      const joinedClassName = ['${className}', attrsProps.className, props.className].filter(Boolean).join(' ')
      return <${tagName} { ...propsWithAttrs } className={joinedClassName} />;
    }
  `)
  })
  return shouldUseClient
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
