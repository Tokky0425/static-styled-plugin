import type { LoaderDefinitionFunction } from 'webpack'
import { outputFileSync } from 'fs-extra'
import { createHash } from 'crypto'
import path from 'path'
import { compile, styleRegistry } from '@static-styled-plugin/compiler'

const injectStyleLoaderPath = require.resolve('./injectStyleLoader')
const injectedStylePath = require.resolve('../assets/injectedStyle.css')

const loader: LoaderDefinitionFunction<{
  themeFilePath: string | null
  cssOutputDir: string | null
}> = function (sourceCode: string) {
  const options = this.getOptions()
  const { themeFilePath, cssOutputDir } = options

  const callback = this.callback
  const resourcePath = this.resourcePath

  if (themeFilePath) {
    // recompile whenever theme file changes
    this.addDependency(path.join(process.cwd(), themeFilePath))
  }

  const {
    code,
    useClientExpressionExtracted,
    hasReactImportStatement,
    shouldUseClient,
  } = compile(sourceCode, resourcePath)

  const useClientExpression =
    useClientExpressionExtracted || shouldUseClient ? '"use client";\n' : ''

  const cssString = styleRegistry.getRule()
  if (!cssString) {
    callback(null, useClientExpression + code)
    return
  }
  styleRegistry.reset()

  const outputPath: string | undefined = this._compilation?.options.output.path
  if (!outputPath) {
    callback(null, useClientExpression + code)
    return
  }

  const reactImportStatement = hasReactImportStatement
    ? ''
    : 'import React from "react";\n'

  if (cssOutputDir) {
    const fileHash = createHash('md5').update(cssString).digest('hex')
    const cssFilePath = path.join(cssOutputDir, `${fileHash}.css`)
    outputFileSync(cssFilePath, cssString)
    const importCSSIdentifier = `import "${cssFilePath}"\n`
    callback(
      null,
      useClientExpression + reactImportStatement + importCSSIdentifier + code,
    )
  } else {
    const injectStyleLoader = `${injectStyleLoaderPath}?${JSON.stringify({
      sourceCode: cssString,
    })}`
    const importCSSIdentifier = `import ${JSON.stringify(
      this.utils.contextify(
        this.context || this.rootContext,
        `static-styled.css!=!${injectStyleLoader}!${injectedStylePath}`,
      ),
    )};\n`
    callback(
      null,
      useClientExpression + reactImportStatement + importCSSIdentifier + code,
    )
  }
}

export default loader
