import path from 'path'
import { Plugin, ResolvedConfig } from 'vite'
import { transform } from '@static-styled-plugin/babel-plugin'
import { styleRegistry } from "@static-styled-plugin/style-registry"

export function staticStyledPlugin(): Plugin {
  const targetExtensionRegex = new RegExp(/\.[jt]sx?$/)
  const cssMap: {
    [cssAbsolutePath: string]: string
  } = {}

  return {
    name: "static-styled",
    enforce: "pre",
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

      const cssAbsolutePath = path.normalize(`${id.replace(targetExtensionRegex, "")}.css`)
      cssMap[cssAbsolutePath] = cssString
      return `import ${JSON.stringify(cssAbsolutePath)};\n${code}`
    },
    resolveId(source) {
      return cssMap[source] ? source : undefined
    },
    load(filePath: string) {
      return cssMap[filePath] ? cssMap[filePath] : undefined
    }
  }
}
