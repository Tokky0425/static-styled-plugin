import { BabelFileResult } from '@babel/core'
import { styleRegistry } from '@static-styled-plugin/style-registry'
import { Node, Project, TaggedTemplateExpression, TemplateLiteral } from 'ts-morph'
import { isHTMLTag } from './isHTMLTag'
import { generateHash } from './generateHash'

let identifier = 0
const project = new Project()

export function transformStyledSyntax(code: string, filePath: string): BabelFileResult {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  file.forEachDescendant((node, traversal) => {
    if (Node.isTaggedTemplateExpression(node)) {
      processTaggedTemplateExpression(node, 'styled')
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

function computeTaggedTemplateLiteral(template: TemplateLiteral) {
  let result = ''
  if (Node.isNoSubstitutionTemplateLiteral(template)) {
    result = template.getLiteralText()
  } else {
    result = template.getHead().getLiteralText()
    const templateSpans = template.getTemplateSpans() // TODO
  }
  return result
}

function processTaggedTemplateExpression(node: TaggedTemplateExpression, styledFunctionName: string) {
  const tagName = getTagName(node.getTag(), styledFunctionName)
  if (!tagName || !isHTMLTag(tagName)) return

  const computedTemplateLiteral = computeTaggedTemplateLiteral(node.getTemplate())
  const cssString = computedTemplateLiteral.replace(/\s+/g, ' ').trim()
  const classNameHash = generateHash(cssString)
  const className = `static-styled-${classNameHash}`
  const componentId = generateHash(String(identifier))
  identifier += 1
  styleRegistry.addRule(componentId, classNameHash, cssString)

  node.replaceWithText(`
    (props: any) => {
      const inheritedClassName = props.className ?? '';
      const joinedClassName = \`\${inheritedClassName} ${className}\`.trim();
      return <${tagName} { ...props } className={joinedClassName} />;
    }
  `)
}
