import type { LoaderDefinitionFunction } from 'webpack'
import { compile, styleRegistry } from '@static-styled-plugin/compiler'

const injectedStylePath = require.resolve('../assets/virtual.static-styled.css')

const loader: LoaderDefinitionFunction<{
  themeFilePath: string | null
}> = function (sourceCode: string) {
  const options = this.getOptions()
  const { themeFilePath } = options

  if (themeFilePath) {
    // recompile whenever theme file changes
    this.addDependency(themeFilePath)
  }

  const {
    code,
    useClientExpressionExtracted,
    hasReactImportStatement,
    shouldUseClient,
  } = compile(sourceCode, this.resourcePath)

  const useClientExpression =
    useClientExpressionExtracted || shouldUseClient ? '"use client";\n' : ''

  const cssString = styleRegistry.getRule()
  if (!cssString) {
    this.callback(null, useClientExpression + code)
    return
  }
  styleRegistry.reset()

  const outputPath: string | undefined = this._compilation?.options.output.path
  if (!outputPath) {
    this.callback(null, useClientExpression + code)
    return
  }

  const reactImportStatement = hasReactImportStatement
    ? ''
    : 'import React from "react";\n'

  const importCSSIdentifier = `import ${JSON.stringify(
    this.utils.contextify(
      this.context || this.rootContext,
      `${injectedStylePath}?css=${cssString}`,
    ),
  )};\n`
  this.callback(
    null,
    useClientExpression + reactImportStatement + importCSSIdentifier + code,
  )
}

export default loader
