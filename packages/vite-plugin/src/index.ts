import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import { Plugin, ResolvedConfig } from 'vite'
import {
  compile,
  styleRegistry,
  themeRegistry,
} from '@static-styled-plugin/compiler'

type Options = {
  tsConfigFilePath?: string
  themeFilePath?: string
  prefix?: string
}

export function staticStyled(options?: Options): Plugin {
  // see https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  const virtualModuleId = 'virtual:static-styled'
  const targetExtensionRegex = new RegExp(/\.tsx?$/)
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}
  let command: ResolvedConfig['command']
  const warnings: string[] = []
  const tsConfigFilePath = buildTsConfigFilePath(
    warnings,
    options?.tsConfigFilePath,
  )
  const themeFilePath = buildThemeFilePath(warnings, options?.themeFilePath)
  const prefix = options?.prefix

  return {
    name: 'static-styled',
    enforce: 'pre',
    configResolved(config) {
      if (themeFilePath) {
        // enable rebuild when theme file and ts-config.json changes
        config.configFileDependencies.push(tsConfigFilePath)
        config.configFileDependencies.push(themeFilePath)
      }
      themeRegistry.register(themeFilePath)
      command = config.command
      warnings.forEach((warning) => console.log(warning))
    },
    transform(sourceCode, id) {
      if (/node_modules/.test(id)) return
      if (!/\/.+?\.tsx$/.test(id)) return
      const devMode = command === 'serve'

      const {
        code,
        useClientExpressionExtracted,
        hasReactImportStatement,
        shouldUseClient,
      } = compile(sourceCode, id, { devMode, tsConfigFilePath, prefix })
      const useClientExpression =
        useClientExpressionExtracted || shouldUseClient ? '"use client";\n' : ''
      const cssString = styleRegistry.getRule()
      if (!cssString) return useClientExpression + code
      styleRegistry.reset()

      const reactImportStatement = hasReactImportStatement
        ? ''
        : 'import React from "react";\n'

      if (devMode) {
        // Manually injecting style tag by injectDevelopmentCSS
        // Reason: Vite injects style tag at the end of head tag when HMR occurs, but style tag by styled-components should come last
        const rootRelativeFilePath = path.relative(process.cwd() + '/src', id)
        const cssRelativeFilePath = path.normalize(
          `${rootRelativeFilePath.replace(targetExtensionRegex, '')}.css`,
        )
        return (
          useClientExpression +
          reactImportStatement +
          injectDevelopmentCSS(cssString, cssRelativeFilePath) +
          code
        )
      }

      const cssAbsolutePath = path.normalize(
        `${id.replace(targetExtensionRegex, '')}.css`,
      )
      const cssMapKey = virtualModuleId + cssAbsolutePath
      cssMap[cssMapKey] = cssString
      return (
        useClientExpression +
        reactImportStatement +
        `import "${virtualModuleId + cssAbsolutePath}";\n` +
        code
      )
    },
    resolveId(id) {
      if (id.startsWith(virtualModuleId)) {
        return '\0' + id
      }
    },
    load(id) {
      if (id.startsWith('\0' + virtualModuleId)) {
        const key = id.replace('\0', '')
        return cssMap[key]
      }
    },
  }
}

const injectDevelopmentCSS = (cssString: string, cssFilePath: string) => {
  return `
  (function() {
    if (typeof window === 'undefined') {
      return;
    }
    const arr = Array.from(document.head.querySelectorAll('style[data-styled]'));
    const styledComponentsEle = arr[0];
    const staticStyledEleId = 'static-styled_' + ${JSON.stringify(cssFilePath)};
    let staticStyledEle = document.getElementById(staticStyledEleId);
    if (!staticStyledEle) {
      staticStyledEle = document.createElement('style');
      staticStyledEle.id = staticStyledEleId;
      document.head.insertBefore(staticStyledEle, styledComponentsEle);
    }
    staticStyledEle.textContent = ${JSON.stringify(cssString)};
  })();
  `
}

function buildTsConfigFilePath(warnings: string[], tsConfigFilePath?: string) {
  const result = path.join(process.cwd(), tsConfigFilePath ?? 'tsconfig.json')
  if (!fs.existsSync(result)) {
    warnings.push(
      `[static-styled-plugin] ` +
        chalk.hex('#000080').bgYellow(' WARN ') +
        ` TS config file (${tsConfigFilePath}) was not found.`,
    )
  }
  return result
}

function buildThemeFilePath(warnings: string[], themeFilePath?: string) {
  const result = themeFilePath ? path.join(process.cwd(), themeFilePath) : null
  if (result && !fs.existsSync(result)) {
    warnings.push(
      `[static-styled-plugin] ` +
        chalk.hex('#000080').bgYellow(' WARN ') +
        ` Theme file path is specified but the file was not found.`,
    )
  }
  return result
}
