// PROTOTYPE (chore/prototype-q1-q4, throwaway). Build-time switches:
//   RAPIER=compat (default) | wasm   -> `#rapier` is @dimforge/rapier3d-compat | @dimforge/rapier3d (+ vite-plugin-wasm)
//   RAPIER_SPLIT=1                   -> `#world` is WorldSplit.tsx and Rapier gets its own chunk
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

const variant = process.env['RAPIER'] === 'wasm' ? 'wasm' : 'compat'
const split = process.env['RAPIER_SPLIT'] === '1'
const rapierPackage = variant === 'wasm' ? '@dimforge/rapier3d' : '@dimforge/rapier3d-compat'

export default defineConfig({
  plugins: [react(), ...(variant === 'wasm' ? [wasm()] : [])],
  resolve: {
    alias: {
      '#rapier': rapierPackage,
      '#world': split ? '/src/world/WorldSplit.tsx' : '/src/world/World.tsx',
    },
  },
  build: {
    // No source maps in the delivered site (constitution 10: nothing beyond the site's own code).
    sourcemap: false,
    minify: process.env['PROTO_MINIFY'] !== '0',
    rollupOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            ...(split ? [{ name: 'rapier', test: /node_modules[\\/]@dimforge[\\/]/ }] : []),
            { name: 'world', test: /node_modules[\\/](three|@react-three|@dimforge)[\\/]|vite-plugin-wasm/ },
          ],
        },
      },
    },
  },
})
