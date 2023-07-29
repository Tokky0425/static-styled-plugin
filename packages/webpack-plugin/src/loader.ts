import fs from 'fs-extra'
import path from 'path'
import type { LoaderDefinitionFunction } from 'webpack'

import { transform, generateHash } from "@static-styled-plugin/babel-plugin"
import { styleRegistry } from "@static-styled-plugin/style-registry"

const loader: LoaderDefinitionFunction = function(sourceCode: string) {
  const { code } = transform(sourceCode)
  if (!code) return ''

  const cssString = styleRegistry.getRule()
  if (!cssString) return code
  styleRegistry.reset()

  const outputPath: string | undefined = this._compilation?.options.output.path
  if (!outputPath) return code

  const hash = generateHash(this.resourcePath)
  const cssFilePath = path.resolve(outputPath, 'static-styled', `${hash}.css`)

  fs.outputFileSync(cssFilePath, cssString)

  return `import "${cssFilePath}";\n${code}`
}

export default loader
