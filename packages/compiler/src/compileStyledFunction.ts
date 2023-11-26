import { Node, SourceFile } from 'ts-morph'
import { styleRegistry } from './styleRegistry'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { compileCssString } from './compileCssString'
import { Theme } from './types'
import { Evaluator, TsEvalError } from './Evaluator'

export function compileStyledFunction(
  file: SourceFile,
  styledFunctionName: string,
  cssFunctionName: string | null,
  theme: Theme | null,
) {
  let shouldUseClient = false
  file.forEachDescendant((node) => {
    if (!Node.isTaggedTemplateExpression(node)) return

    const tagNode = node.getTag()
    const { htmlTagName, isStyledFunction } = parseTaggedTemplateExpression(
      tagNode,
      styledFunctionName,
    )
    if (!isStyledFunction) {
      return
    } else if (!htmlTagName || !isHTMLTag(htmlTagName)) {
      shouldUseClient = true
      return
    }

    const evaluator = new Evaluator({
      extra: {},
      definition: { cssFunctionName },
      theme,
    })
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

    const attrsArr = getAttrs(tagNode)
    const attrsDeclaration = attrsArr
      .map((attrs, index) => `const attrs${index} = ${attrs.text}`)
      .join('\n')
    const attrsProps = attrsArr
      .map((attrs, index) => {
        switch (attrs.nodeKindName) {
          case 'ArrowFunction':
            return `...attrs${index}(props)`
          case 'ObjectLiteralExpression':
            return `...attrs${index}`
          default: {
            const neverValue: never = attrs.nodeKindName
            throw new Error(`${neverValue}`)
          }
        }
      })
      .join(', ')

    node.replaceWithText(`
    (props: any) => {
      ${attrsDeclaration}
      const attrsProps = { ${attrsProps} } as any
      const propsWithAttrs = { ...props, ...attrsProps } as any
      const joinedClassName = ['${className}', attrsProps.className, props.className].filter(Boolean).join(' ')
      return <${htmlTagName} { ...propsWithAttrs } className={joinedClassName} />;
    }
  `)
  })
  return shouldUseClient
}

type ParseTaggedTemplateExpressionResult = {
  htmlTagName: string | null
  isStyledFunction: boolean
}

export function parseTaggedTemplateExpression(
  node: Node,
  styledFunctionName: string,
): ParseTaggedTemplateExpressionResult {
  const result: ParseTaggedTemplateExpressionResult = {
    htmlTagName: null,
    isStyledFunction: false,
  }
  if (
    /* e.g. styled('p') */ Node.isCallExpression(node) &&
    node.compilerNode.expression.getText() === styledFunctionName
  ) {
    const arg = node.getArguments()[0]
    result.htmlTagName = Node.isStringLiteral(arg)
      ? arg.getLiteralValue()
      : null
    result.isStyledFunction = true
  } else if (
    /* e.g. styled.p */ Node.isPropertyAccessExpression(node) &&
    node.compilerNode.expression.getText() === styledFunctionName
  ) {
    result.htmlTagName = node.compilerNode.name.getText() ?? null
    result.isStyledFunction = true
  } else if (
    Node.isCallExpression(node) ||
    Node.isPropertyAccessExpression(node)
  ) {
    // for when .attrs is used
    const expression = node.getExpression()
    if (
      Node.isCallExpression(expression) ||
      Node.isPropertyAccessExpression(expression)
    ) {
      const res = parseTaggedTemplateExpression(expression, styledFunctionName)
      result.htmlTagName = res.htmlTagName
      result.isStyledFunction = res.isStyledFunction
    }
  }
  return result
}

type GetAttrsResult = {
  nodeKindName: 'ArrowFunction' | 'ObjectLiteralExpression'
  text: string
}

export function getAttrs(node: Node): GetAttrsResult[] {
  let result: GetAttrsResult[] = []

  if (!Node.isCallExpression(node)) return result
  const expression = node.getExpression()
  if (
    !(
      Node.isPropertyAccessExpression(expression) &&
      expression.getName() === 'attrs'
    )
  )
    return result

  // recursively call getAttrs because attrs can be chained
  // e.g. const Text = styled.p.attrs().attrs()``
  const nextExpression = expression.getExpression()
  const nextExpressionResult = getAttrs(nextExpression)
  if (nextExpressionResult) {
    result = [...nextExpressionResult]
  }

  const argument = node.getArguments()[0]
  if (Node.isArrowFunction(argument)) {
    return [
      ...result,
      {
        nodeKindName: 'ArrowFunction' as const,
        text: argument.getFullText(),
      },
    ]
  } else if (Node.isObjectLiteralExpression(argument)) {
    return [
      ...result,
      {
        nodeKindName: 'ObjectLiteralExpression' as const,
        text: argument.getFullText(),
      },
    ]
  } else {
    throw new Error('unexpected expression for attrs')
  }
}
