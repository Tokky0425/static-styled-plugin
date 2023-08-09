import path from 'path'
import { Plugin, ResolvedConfig } from 'vite'
import { transform } from '@static-styled-plugin/babel-plugin'
import { styleRegistry } from "@static-styled-plugin/style-registry"

export function staticStyledPlugin(): Plugin {
  // see https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  const virtualModuleId = 'virtual:static-styled'
  const targetExtensionRegex = new RegExp(/\.tsx?$/)
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}
  let command: ResolvedConfig['command']

  return {
    name: 'static-styled',
    enforce: 'pre',
    configResolved(config) {
      command = config.command
    },
    transform(sourceCode, id) {
      if (/node_modules/.test(id)) return
      if (!/\/.+?\.tsx$/.test(id)) return

      const theme = {
        fontSize: {
          s: '0.75rem',
          m: '1rem',
          l: '1.25rem',
        }
      }

      const result = transform(sourceCode, id, theme)
      const code = result?.code
      if (!code) return sourceCode

      const cssString = styleRegistry.getRule()
      if (!cssString) return code
      styleRegistry.reset()

      if (command === 'serve') {
        // Manually injecting style tag by injectDevelopmentCSS
        // Reason: Vite injects style tag at the end of head tag when HMR occurs, but style tag by styled-components should come last
        const rootRelativeFilePath = path.relative(process.cwd() + '/src', id)
        const cssRelativeFilePath = path.normalize(`${rootRelativeFilePath.replace(targetExtensionRegex, "")}.css`)
        return injectDevelopmentCSS(cssString, cssRelativeFilePath) + code
      }

      const cssAbsolutePath = path.normalize(`${id.replace(targetExtensionRegex, "")}.css`)
      const cssMapKey = virtualModuleId + cssAbsolutePath
      cssMap[cssMapKey] = cssString
      return `import "${virtualModuleId + cssAbsolutePath}";\n${code}`
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
    const staticStyleEleId = 'static-styled_' + ${cssFilePath};
    let staticStyleEle = document.getElementById(staticStyleEleId);
    if (!staticStyleEle) {
      staticStyleEle = document.createElement('style');
      staticStyleEle.id = staticStyleEleId;
      document.head.appendChild(staticStyleEle);
    }
    staticStyleEle.textContent = ${JSON.stringify(cssString)};
  })();
  `
}
