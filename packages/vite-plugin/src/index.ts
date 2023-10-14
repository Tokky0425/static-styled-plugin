import path from 'path'
import { Plugin, ResolvedConfig } from 'vite'
import { compile, parseTheme } from '@static-styled-plugin/compiler'
import { styleRegistry } from "@static-styled-plugin/style-registry"

type Options = {
  themeFilePath?: string
}

export function staticStyledPlugin(options?: Options): Plugin {
  // see https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  const virtualModuleId = 'virtual:static-styled'
  const targetExtensionRegex = new RegExp(/\.tsx?$/)
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}
  let command: ResolvedConfig['command']
  const themeFilePath = options?.themeFilePath
  const theme = themeFilePath ? parseTheme(themeFilePath) : null

  return {
    name: 'static-styled',
    enforce: 'pre',
    configResolved(config) {
      command = config.command
    },
    transform(sourceCode, id) {
      if (/node_modules/.test(id)) return
      if (!/\/.+?\.tsx$/.test(id)) return

      const { code, useClientExpressionExtracted } = compile(sourceCode, id, theme)
      const cssString = styleRegistry.getRule()
      if (!cssString) return code
      styleRegistry.reset()
      const useClientExpression = useClientExpressionExtracted ? '\'use client\';' : ''

      if (command === 'serve') {
        // Manually injecting style tag by injectDevelopmentCSS
        // Reason: Vite injects style tag at the end of head tag when HMR occurs, but style tag by styled-components should come last
        const rootRelativeFilePath = path.relative(process.cwd() + '/src', id)
        const cssRelativeFilePath = path.normalize(`${rootRelativeFilePath.replace(targetExtensionRegex, '')}.css`)
        return useClientExpression + injectDevelopmentCSS(cssString, cssRelativeFilePath) + code
      }

      const cssAbsolutePath = path.normalize(`${id.replace(targetExtensionRegex, '')}.css`)
      const cssMapKey = virtualModuleId + cssAbsolutePath
      cssMap[cssMapKey] = cssString
      return `${useClientExpression}\nimport "${virtualModuleId + cssAbsolutePath}";\n${code}`
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
