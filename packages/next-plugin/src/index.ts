import type { NextConfig } from 'next'
import type { Configuration } from 'webpack'
import { StaticStyledPlugin } from '@static-styled-plugin/webpack-plugin'

type Options = {
  tsConfigFilePath?: string
  themeFilePath?: string
  prefix?: string
}

export function withStaticStyled(options: Options) {
  return function (nextConfig: NextConfig = {}) {
    return Object.assign({}, nextConfig, {
      webpack(config: Configuration) {
        config.plugins?.push(new StaticStyledPlugin(options))
        return config
      },
    } as NextConfig)
  }
}
