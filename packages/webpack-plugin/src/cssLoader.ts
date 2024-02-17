import type { LoaderContext, LoaderDefinitionFunction } from 'webpack'

const loader: LoaderDefinitionFunction = function cssLoader(
  this: LoaderContext<unknown>,
  src: string,
) {
  const params = new URLSearchParams(decodeURIComponent(this.resourceQuery))
  const css = `${src}\n${params.get('css') ?? ''}`
  this.callback(undefined, css)
}

export default loader
