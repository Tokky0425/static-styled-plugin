import type { LoaderDefinitionFunction } from 'webpack'
import { Theme, compile } from '@static-styled-plugin/compiler'
import { styleRegistry } from '@static-styled-plugin/style-registry'

const injectStyleLoaderPath = require.resolve('./injectStyleLoader')
const injectedStylePath = require.resolve(`../assets/injectedStyle.css`)

const loader: LoaderDefinitionFunction<{ theme: Theme | null }> = function(sourceCode: string) {
  const options = this.getOptions()
  const theme = options.theme

  const callback = this.callback
  const resourcePath = this.resourcePath
  const { code, useClientExpressionExtracted } = compile(sourceCode, resourcePath, theme)
  const cssString = styleRegistry.getRule()
  if (!cssString) {
    callback(null, code)
    return
  }
  styleRegistry.reset()

  const outputPath: string | undefined = this._compilation?.options.output.path
  if (!outputPath) {
    callback(null, code)
    return
  }

  const injectStyleLoader = `${injectStyleLoaderPath}?${JSON.stringify({
    sourceCode: cssString
  })}`

  const importCSSIdentifier = `import ${JSON.stringify(
    this.utils.contextify(
      this.context || this.rootContext,
      `static-styled.css!=!${injectStyleLoader}!${injectedStylePath}`)
  )};`

  const useClientExpression = useClientExpressionExtracted ? '\'use client\';' : ''
  callback(null, `${useClientExpression}\n${importCSSIdentifier}\n${code}`)
}

export default loader
