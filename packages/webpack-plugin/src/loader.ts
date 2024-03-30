import type { LoaderDefinitionFunction } from 'webpack'
import { compile, styleRegistry } from '@static-styled-plugin/compiler'
import fs, { existsSync, writeFileSync } from 'fs'
import path from 'path'

const virtualCssPath = (() => {
  const absPath = path.join(__dirname, '../virtual.static-styled.css')
  if (!existsSync(absPath)) {
    writeFileSync(absPath, '')
  }
  return absPath
})()

const loader: LoaderDefinitionFunction<{
  tsConfigFilePath: string
  themeFilePath: string | null
  devMode: boolean
  prefix?: string
}> = function (sourceCode: string) {
  const options = this.getOptions()
  const { tsConfigFilePath, themeFilePath, devMode, prefix } = options

  if (themeFilePath) {
    // recompile whenever theme file and tsconfig.json changes
    this.addDependency(tsConfigFilePath)
    this.addDependency(themeFilePath)
  }

  const {
    code,
    useClientExpressionExtracted,
    hasReactImportStatement,
    shouldUseClient,
  } = compile(sourceCode, this.resourcePath, {
    devMode,
    tsConfigFilePath,
    prefix,
  })

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
      `${virtualCssPath}?css=${encodeURIComponent(cssString)}`,
    ),
  )};\n`

  if (devMode) {
    // Next.js skips HMR for Client Component when there is no change in the CSS file.
    // To enable HMR, we need to make a diff for the CSS file.
    fs.writeFileSync(virtualCssPath, `/* ${Date.now()} */`)
  }

  this.callback(
    null,
    useClientExpression + reactImportStatement + importCSSIdentifier + code,
  )
}

export default loader
