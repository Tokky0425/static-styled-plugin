import path from 'path'
import { Plugin, ResolvedConfig } from 'vite'
import { transform } from '@static-styled-plugin/babel-plugin'
import { styleRegistry } from "@static-styled-plugin/style-registry"

export function staticStyledPlugin(): Plugin {
  const targetExtensionRegex = new RegExp(/\.[jt]sx?$/)
  let command: ResolvedConfig['command']
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}

  return {
    name: "static-styled",
    configResolved(config) {
      command = config.command
    },
    async transform(sourceCode, id) {
      if (/node_modules/.test(id)) return
      if (!/\/.+?\.tsx$/.test(id)) return

      const { code } = await transform(sourceCode)
      const cssString = styleRegistry.getRule()
      if (!cssString) return code
      styleRegistry.reset()

      if (command === 'serve') {
        const rootRelativeFilePath = path.relative(process.cwd() + '/src', id)
        const cssRelativeFilePath = path.normalize(`${rootRelativeFilePath.replace(targetExtensionRegex, "")}.css`)
        return injectDevelopmentCSS(cssString, cssRelativeFilePath) + code
      } else if (command === 'build') {
        const cssAbsolutePath = path.normalize(`${id.replace(targetExtensionRegex, "")}.css`)
        cssMap[cssAbsolutePath] = cssString
        return injectProductionCSS(cssAbsolutePath) + code
      }
    },
    resolveId(source) {
      return cssMap[source] ? source : undefined
    },
    load(filePath: string) {
      return cssMap[filePath] ? cssMap[filePath] : undefined
    }
  }
}

const injectDevelopmentCSS = (cssString: string, cssFilePath: string) => {
  return `
  (function() {
    if (typeof window === 'undefined') {
      return;
    }
    const staticStyleEleId = 'static-styled_' + ${JSON.stringify(cssFilePath)};
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

const injectProductionCSS = (cssFilePath: string) => {
  return `import ${JSON.stringify(cssFilePath)};\n`
}
