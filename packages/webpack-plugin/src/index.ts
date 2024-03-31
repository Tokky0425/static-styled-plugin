import path from 'path'
import * as fs from 'fs'
import chalk from 'chalk'
import type { Compiler } from 'webpack'
import { themeRegistry } from '@static-styled-plugin/compiler'

type Options = {
  tsConfigFilePath?: string
  themeFilePath?: string
  prefix?: string
}

const pluginName = 'StaticStyledPlugin'
export class StaticStyledPlugin {
  tsConfigFilePath: string
  themeFilePath: string | null
  prefix?: string
  warnings: string[]

  constructor(options?: Options) {
    this.warnings = []
    this.tsConfigFilePath = this.buildTsConfigFilePath(
      options?.tsConfigFilePath,
    )
    this.themeFilePath = this.buildThemeFilePath(options?.themeFilePath)
    this.prefix = options?.prefix
  }
  apply(compiler: Compiler) {
    this.warnings.forEach((warning) => console.log(warning))

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
              tsConfigFilePath: this.tsConfigFilePath,
              themeFilePath: this.themeFilePath,
              devMode: compiler.options.mode === 'development',
              prefix: this.prefix,
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

  private buildTsConfigFilePath(tsConfigFilePath?: string) {
    const result = path.join(process.cwd(), tsConfigFilePath ?? 'tsconfig.json')
    if (!fs.existsSync(result)) {
      this.warnings.push(
        `[static-styled-plugin] ` +
          chalk.hex('#000080').bgYellow(' WARN ') +
          ` TS config file (${tsConfigFilePath}) was not found.`,
      )
    }
    return result
  }

  private buildThemeFilePath(themeFilePath?: string) {
    const result = themeFilePath
      ? path.join(process.cwd(), themeFilePath)
      : null
    if (result && !fs.existsSync(result)) {
      this.warnings.push(
        `[static-styled-plugin] ` +
          chalk.hex('#000080').bgYellow(' WARN ') +
          ` Theme file path is specified but the file was not found.`,
      )
    }
    return result
  }
}
