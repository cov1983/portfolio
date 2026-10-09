import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // No source maps in the delivered site (constitution 10: nothing beyond the site's own code).
    sourcemap: false,
  },
})
