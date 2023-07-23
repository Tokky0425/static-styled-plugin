import { types, template as coreTemplate } from "@babel/core"
import type { NodePath } from "@babel/core"
import { styleRegistry } from "@static-styled-plugin/style-registry"
import { generateHash } from "./generateHash"
import { isHTMLTag } from "./isHTMLTag"

function injectReactImport(programPath: NodePath<types.Program>, t: typeof types) {
  let hasReactImport = false

  programPath.node.body.forEach((node) => {
    if (t.isImportDeclaration(node) && node.source.value === 'react' && node.specifiers.some((specifier) => t.isImportDefaultSpecifier(specifier) && specifier.local.name === 'React')) {
      hasReactImport = true
    }
  })

  if (!hasReactImport) {
    const reactImportDeclaration = t.importDeclaration([t.importDefaultSpecifier(t.identifier("React"))], t.stringLiteral("react"))
    programPath.unshiftContainer('body', reactImportDeclaration)
  }
}

function getStyledFunctionName(programPath: NodePath<types.Program>, t: typeof types) {
  let styledFunctionName = ''

  programPath.node.body.forEach((node) => {
    if (t.isImportDeclaration(node) && node.source.value === 'styled-components') {
      node.specifiers.forEach((specifier) => {
        if (t.isImportDefaultSpecifier(specifier) && t.isIdentifier(specifier.local)) {
          styledFunctionName = specifier.local.name
        }
      })
    }
  })

  return styledFunctionName
}

let identifier = 0

function processTaggedTemplateExpression(programPath: NodePath<types.Program>, t: typeof types, template: typeof coreTemplate, styledFunctionName: string) {
  programPath.traverse({
    TaggedTemplateExpression(path) {
      const { node } = path
      /* Only non-extended style (e.g. styled('p')) can be generated statically because level of detail cannot be handled properly when components are extended. */
      let tagName: string | null = ''
      let quasi: ReturnType<typeof types.templateElement> | null = null
      if (/* e.g. styled('p') */ t.isCallExpression(node.tag) && t.isIdentifier(node.tag.callee) && node.tag.callee.name === styledFunctionName) {
        quasi = node.quasi.quasis[0]
        const arg = node.tag.arguments[0]
        tagName = t.isStringLiteral(arg) ? arg.value : null
      } else if (/* e.g. styled.p */ t.isMemberExpression(node.tag) && t.isIdentifier(node.tag.object) && node.tag.object.name === styledFunctionName && t.isIdentifier(node.tag.property) && node.tag.object) {
        quasi = node.quasi.quasis[0]
        tagName = node.tag.property.name
      } else {
        return
      }
      if (!quasi || !tagName || !isHTMLTag(tagName)) return

      const cssString = quasi.value.raw.replace(/\s+/g, " ").trim()
      const classNameHash = generateHash(cssString)
      const className = `static-styled-${classNameHash}`
      const createElementAst = template.expression.ast(`
        (props) => {
          const inheritedClassName = props.className ?? '';
          return React.createElement("${tagName}", { ...props, className: \`\${inheritedClassName} ${className}\`.trim() });
        }
      `)
      path.replaceWith(createElementAst)
      const componentId = generateHash(String(identifier))
      identifier += 1
      styleRegistry.addRule(componentId, classNameHash, cssString)
    }
  })
}

export function visitor(t: typeof types, template: typeof coreTemplate) {
  return {
    Program(path: NodePath<types.Program>) {
      const styledFunctionName = getStyledFunctionName(path, t)
      if (!styledFunctionName) return
      injectReactImport(path, t)
      processTaggedTemplateExpression(path, t, template, styledFunctionName)
    }
  }
}
