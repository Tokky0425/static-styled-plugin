# static-styled-plugin

A plugin that makes styled-components zero-runtime.

## Installation

```sh
npm install @static-styled/webpack-plugin
```

## Setup

```js
// webpack.config.js
const StaticStyledPlugin = require('@static-styled-plugin/webpack-plugin')

module.exports = {
  plugins: [
    new StaticStyledPlugin({ themeFilePath: './src/theme.ts' }),
  ]
}
```

⚠️ **Note**: You need to setup loaders that can handle `.css` files, such as `css-loader` and `style-loader`, as well.
