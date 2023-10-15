import type { Compiler } from 'webpack'
import type { Theme } from '@static-styled-plugin/compiler'
import { parseTheme } from '@static-styled-plugin/compiler'

type Options = {
  themeFilePath?: string
  cssOutputDir?: string
}

export class StaticStyledPlugin {
  theme: Theme | null
  cssOutputDir: string | null

  constructor(options?: Options) {
    const themeFilePath = options?.themeFilePath
    this.theme = themeFilePath ? parseTheme(themeFilePath) : null
    this.cssOutputDir = options?.cssOutputDir ?? null
  }
  apply(compiler: Compiler) {
    compiler.options.module?.rules.push({
      test: /\/.+?\.tsx$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('./loader'),
          options: {
            theme: this.theme,
            cssOutputDir: this.cssOutputDir,
          }
        }
      ]
    })
  }
}
