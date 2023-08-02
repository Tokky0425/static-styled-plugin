import { transformSync, types, template as coreTemplate } from "@babel/core"
import type { PluginObj } from "@babel/core"
import { visitor } from './visitor'

export function transform(sourceCode: string) {
  const result = transformSync(sourceCode, {
    sourceMaps: true,
    plugins: [plugin]
  })
  return result!
}
function plugin({ types: t, template }: { types: typeof types, template: typeof coreTemplate }): PluginObj {
  return {
    name: 'static-styled-plugin',
    manipulateOptions(opts, parserOpts) {
      parserOpts.plugins.push('jsx')
      parserOpts.plugins.push('typescript')
    },
    visitor: visitor(t, template),
  }
}
