import path from 'path'
import * as fs from 'fs'
import type { Compiler } from 'webpack'
import { themeRegistry } from '@static-styled-plugin/compiler'

type Options = {
  themeFilePath?: string
  cssOutputDir?: string
}

const pluginName = 'StaticStyledPlugin'
export class StaticStyledPlugin {
  themeFilePath: string | null
  cssOutputDir: string | null

  constructor(options?: Options) {
    this.themeFilePath = options?.themeFilePath
      ? path.join(process.cwd(), options.themeFilePath)
      : null
    this.cssOutputDir = options?.cssOutputDir ?? null
  }
  apply(compiler: Compiler) {
    if (this.themeFilePath && !fs.existsSync(this.themeFilePath)) {
      console.log('Theme file path is specified but the file was not found.')
    }

    compiler.hooks.beforeCompile.tap(pluginName, () => {
      themeRegistry.register(this.themeFilePath)
    })
    compiler.options.module?.rules.push({
      test: /\/.+?\.tsx$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('./loader'),
          options: {
            themeFilePath: this.themeFilePath,
            cssOutputDir: this.cssOutputDir,
          },
        },
      ],
    })
  }
}
