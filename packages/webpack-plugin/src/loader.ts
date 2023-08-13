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
  const result = compile(sourceCode, resourcePath, theme)
  const code = result?.code
  if (!code) {
    callback(null, sourceCode)
    return
  }

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

  callback(null, `${importCSSIdentifier}\n${code}`)
}

export default loader
