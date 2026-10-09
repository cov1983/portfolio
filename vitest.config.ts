import { defineConfig } from 'vitest/config'

// Unit tests run under Node. The spec (docs/spec/increment-1.md, Testing decisions) defines two
// seams: the built site in a browser (Playwright, tests/e2e) and the World model stepped without a
// renderer (tests/model). React rendering is proven by the browser seam, so the coverage ratchet
// below measures only model code and instruments, never components.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/vite-env.d.ts', '**/*.test.*'],
      reporter: ['text', 'lcov'],
      // Ratchet: autoUpdate rewrites these numbers whenever a local run beats them; the bumped file
      // is committed with the change. Lowering a number needs an ADR (CLAUDE.md).
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        autoUpdate: true,
      },
    },
  },
})
