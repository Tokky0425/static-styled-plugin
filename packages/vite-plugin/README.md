# static-styled-plugin

A plugin that makes styled-components zero-runtime.

## Installation

```sh
npm install @static-styled/vite-plugin
```

## Setup

```js
// vite.config.js
import { staticStyled } from '@static-styled-plugin/vite-plugin'

export default defineConfig({
  plugins: [react(), staticStyled({ themeFilePath: './src/theme.ts' })],
})
```
