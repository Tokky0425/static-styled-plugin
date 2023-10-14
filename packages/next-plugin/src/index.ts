import type { NextConfig } from 'next'
import type { Configuration } from 'webpack'
import { StaticStyledPlugin } from '@static-styled-plugin/webpack-plugin'


export const withStaticStyled = (
  nextConfig: NextConfig = {}
) => {
  return Object.assign({}, nextConfig, {
    webpack(config: Configuration) {
      config.plugins?.push(new StaticStyledPlugin())
      return config
    }
  } as NextConfig)
}
