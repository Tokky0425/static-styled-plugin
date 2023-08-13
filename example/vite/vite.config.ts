import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { staticStyledPlugin } from '@static-styled-plugin/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), staticStyledPlugin({ themeFilePath: 'src/theme.ts' })],
})
