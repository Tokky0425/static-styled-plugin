import { BabelFileResult } from '@babel/core'
import { styleRegistry } from '@static-styled-plugin/style-registry'
import { Node, Project, TaggedTemplateExpression, TemplateLiteral } from 'ts-morph'
import { evaluate } from 'ts-evaluator'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'
import { Theme } from './types'

let identifier = 0
const project = new Project()
const TsEvalError = Symbol('EvalError')

export function transformStyledSyntax(code: string, filePath: string, theme: Theme): BabelFileResult {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  file.forEachDescendant((node, traversal) => {
    if (Node.isTaggedTemplateExpression(node)) {
      processTaggedTemplateExpression(node, 'styled', theme)
    }
  })
  return { code: file.getFullText() }
}

function getTagName(tag: Node, styledFunctionName: string) {
  let tagName: string | null = null
  if (/* e.g. styled('p') */ Node.isCallExpression(tag) && tag.compilerNode.expression.getText() === styledFunctionName) {
    const arg = tag.getArguments()[0]
    tagName = Node.isStringLiteral(arg) ? arg.getLiteralValue() : null
  } else if (/* e.g. styled.p */ Node.isMemberExpression(tag) && tag.compilerNode.expression.getText() === styledFunctionName) {
    tagName = tag.compilerNode.name.getText() ?? null
  }
  return tagName
}

function evaluateTaggedTemplateLiteral(template: TemplateLiteral, theme: Theme) {
  let result = ''

  if (Node.isNoSubstitutionTemplateLiteral(template)) {
    result = template.getLiteralText()
  } else {
    result = template.getHead().getLiteralText()
    const templateSpans = template.getTemplateSpans()

    for (let i = 0; i < templateSpans.length; i++) {
      const templateSpan = templateSpans[i]
      const templateSpanExpression = templateSpan.getExpression()
      if (!Node.isArrowFunction(templateSpanExpression)) return TsEvalError

      const evaluated = evaluate({
        node: templateSpanExpression.getBody().compilerNode as any,
        environment: {
          extra: {
            props: { theme },
            theme: theme
          }
        }
      })
      if (!evaluated.success) return TsEvalError

      const templateMiddle = templateSpan.getLiteral().getLiteralText()
      result += (evaluated.value + templateMiddle)
    }
  }
  return result
}

function processTaggedTemplateExpression(node: TaggedTemplateExpression, styledFunctionName: string, theme: Theme) {
  const tagName = getTagName(node.getTag(), styledFunctionName)
  if (!tagName || !isHTMLTag(tagName)) return

  const result = evaluateTaggedTemplateLiteral(node.getTemplate(), theme)
  if (result === TsEvalError) return

  const cssString = result.replace(/\s+/g, ' ').trim()
  const classNameHash = generateHash(cssString)
  const className = `static-styled-${classNameHash}`
  identifier += 1
  styleRegistry.addRule(classNameHash, cssString)

  node.replaceWithText(`
    (props: any) => {
      const inheritedClassName = props.className ?? '';
      const joinedClassName = \`\${inheritedClassName} ${className}\`.trim();
      return <${tagName} { ...props } className={joinedClassName} />;
    }
  `)
}
