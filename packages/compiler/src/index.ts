import { transformAsync, types, template as coreTemplate } from "@babel/core"
import type { PluginObj } from "@babel/core"
import { visitor } from './visitor'
import { transformStyledSyntax } from './transformStyledSyntax'
import { Theme } from './types'
export { parseTheme } from './parseTheme'
export type { Theme } from './types'

export function transform(sourceCode: string, filePath: string, theme: Theme | null) {
  return transformStyledSyntax(sourceCode, filePath, theme)

  // let result = await transformAsync(sourceCode, {
  //   sourceMaps: true,
  //   plugins: [plugin]
  // })
  // result = result?.code ? transformStyledSyntax(sourceCode, filePath) : null
  // return result
}
// function plugin({ types: t, template }: { types: typeof types, template: typeof coreTemplate }): PluginObj {
//   return {
//     name: 'static-styled-plugin',
//     manipulateOptions(opts, parserOpts) {
//       parserOpts.plugins.push('jsx')
//       parserOpts.plugins.push('typescript')
//     },
//     visitor: visitor(t, template),
//   }
// }
