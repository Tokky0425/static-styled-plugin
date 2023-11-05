import type { LoaderDefinitionFunction } from 'webpack'

const injectStyleLoader: LoaderDefinitionFunction<{ sourceCode: string }> =
  function rawLoader() {
    const options = this.getOptions()
    return options.sourceCode
  }

export default injectStyleLoader
