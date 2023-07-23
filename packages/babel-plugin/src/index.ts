import { parseSync, transformFromAstSync, types, template as coreTemplate } from "@babel/core"
import type { PluginObj } from "@babel/core"
import { visitor } from './visitor'

export async function transform(sourceCode: string) {
  const parsedAst = parseSync(sourceCode)
  const result = await transformFromAstSync(parsedAst!, sourceCode, {
    plugins: [plugin]
  })
  return result!
}
function plugin({ types: t, template }: { types: typeof types, template: typeof coreTemplate }): PluginObj {
  return {
    name: 'static-styled-css-plugin',
    visitor: visitor(t, template),
  }
}
