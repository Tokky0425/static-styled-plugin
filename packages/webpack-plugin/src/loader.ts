import type { LoaderDefinitionFunction } from 'webpack'
import { transform } from "@static-styled-plugin/babel-plugin"
import { styleRegistry } from "@static-styled-plugin/style-registry"

const injectStyleLoaderPath = require.resolve('./injectStyleLoader')
const injectedStylePath = require.resolve(`../assets/injectedStyle.css`)

const loader: LoaderDefinitionFunction = function(sourceCode: string) {
  // c.f. https://webpack.js.org/api/loaders/#asynchronous-loaders
  const callback = this.async();
  transform(sourceCode).then((result) => {
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
  })
}

export default loader
