import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { staticStyled } from '@static-styled-plugin/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), staticStyled({ themeFilePath: 'src/theme.ts' })],
})
