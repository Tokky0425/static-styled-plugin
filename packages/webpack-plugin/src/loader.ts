import type { LoaderDefinitionFunction } from 'webpack'
import { transform } from "@static-styled-plugin/babel-plugin"
import { styleRegistry } from "@static-styled-plugin/style-registry"

const injectStyleLoaderPath = require.resolve('./injectStyleLoader')
const injectedStylePath = require.resolve(`../assets/injectedStyle.css`)

const loader: LoaderDefinitionFunction = function(sourceCode: string) {
  // TODO transform should be async function
  // c.f. https://webpack.js.org/api/loaders/#asynchronous-loaders
  const { code } = transform(sourceCode)
  if (!code) return ''

  const cssString = styleRegistry.getRule()
  if (!cssString) return code
  styleRegistry.reset()

  const outputPath: string | undefined = this._compilation?.options.output.path
  if (!outputPath) return code

  const injectStyleLoader = `${injectStyleLoaderPath}?${JSON.stringify({
    sourceCode: cssString
  })}`

  const importCSSIdentifier = `import ${JSON.stringify(
    this.utils.contextify(
      this.context || this.rootContext,
      `static-styled.css!=!${injectStyleLoader}!${injectedStylePath}`)
  )};`

  this.callback(null, `${importCSSIdentifier}\n${code}`)
  return
}

export default loader
