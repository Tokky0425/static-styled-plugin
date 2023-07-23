import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { staticCSSPlugin } from '@static-styled-plugin/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), staticCSSPlugin()],
})
