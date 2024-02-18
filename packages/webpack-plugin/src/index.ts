import path from 'path'
import * as fs from 'fs'
import chalk from 'chalk'
import type { Compiler } from 'webpack'
import { themeRegistry } from '@static-styled-plugin/compiler'

type Options = {
  themeFilePath?: string
}

const pluginName = 'StaticStyledPlugin'
export class StaticStyledPlugin {
  themeFilePath: string | null

  constructor(options?: Options) {
    this.themeFilePath = options?.themeFilePath
      ? path.join(process.cwd(), options.themeFilePath)
      : null
  }
  apply(compiler: Compiler) {
    if (this.themeFilePath && !fs.existsSync(this.themeFilePath)) {
      console.log(
        `[static-styled-plugin] ` +
          chalk.hex('#000080').bgYellow(' WARN ') +
          ` Theme file path is specified but the file was not found.`,
      )
    }

    compiler.hooks.beforeCompile.tap(pluginName, () => {
      themeRegistry.register(this.themeFilePath)
    })
    compiler.options.module?.rules.push(
      {
        test: /\/.+?\.tsx$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve('./loader'),
            options: {
              themeFilePath: this.themeFilePath,
              devMode: compiler.options.mode === 'development',
            },
          },
        ],
      },
      {
        test: /\/virtual\.static-styled\.css/,
        use: [
          {
            loader: require.resolve('./cssLoader'),
          },
        ],
      },
    )
  }
}
