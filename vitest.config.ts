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
      // Ratchet: the floor never moves on its own. `make coverage-ratchet` sets COVERAGE_RATCHET=1,
      // which lets autoUpdate rewrite these numbers to the measured coverage; commit the result.
      // Lowering a number needs an ADR (CLAUDE.md).
      // ratchet starting floor, 2026-10-09; autoUpdate raises it
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        autoUpdate: process.env.COVERAGE_RATCHET === '1',
      },
    },
  },
})
