import type { Compiler } from 'webpack'

export class StaticStyledPlugin {
  apply(compiler: Compiler) {
    compiler.options.module?.rules.push({
      test: /\/.+?\.tsx$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('./loader'),
        }
      ]
    })
  }
}
