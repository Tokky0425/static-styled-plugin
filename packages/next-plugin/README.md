# static-styled-plugin

A plugin that makes styled-components zero-runtime.

## Installation

```sh
npm install @static-styled-plugin/next-plugin
```

## Setup

```js
// next.config.mjs
import { withStaticStyled } from '@static-styled-plugin/next-plugin'

const nextConfig = {
  compiler: {
    styledComponents: true,
  },
}

export default withStaticStyled({
  themeFilePath: './app/theme.ts'
})(nextConfig)
```
