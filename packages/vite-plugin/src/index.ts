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
  themeFilePath?: string
}

export default function staticStyled(options?: Options): Plugin {
  // see https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  const virtualModuleId = 'virtual:static-styled'
  const targetExtensionRegex = new RegExp(/\.tsx?$/)
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}
  let command: ResolvedConfig['command']
  const themeFilePath = options?.themeFilePath
    ? path.join(process.cwd(), options.themeFilePath)
    : null

  return {
    name: 'static-styled',
    enforce: 'pre',
    configResolved(config) {
      if (themeFilePath) {
        // enable rebuild when theme file changes
        config.configFileDependencies.push(themeFilePath)
        if (!fs.existsSync(themeFilePath)) {
          console.log(
            `[static-styled-plugin] ` +
              chalk.hex('#000080').bgYellow(' WARN ') +
              ` Theme file path is specified but the file was not found.`,
          )
        }
      }
      themeRegistry.register(themeFilePath)
      command = config.command
    },
    transform(sourceCode, id) {
      if (/node_modules/.test(id)) return
      if (!/\/.+?\.tsx$/.test(id)) return

      const {
        code,
        useClientExpressionExtracted,
        hasReactImportStatement,
        shouldUseClient,
      } = compile(sourceCode, id)
      const useClientExpression =
        useClientExpressionExtracted || shouldUseClient ? '"use client";\n' : ''
      const cssString = styleRegistry.getRule()
      if (!cssString) return useClientExpression + code
      styleRegistry.reset()

      const reactImportStatement = hasReactImportStatement
        ? ''
        : 'import React from "react";\n'

      if (command === 'serve') {
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
