import { defineConfig } from 'vitest/config'

// Two Node projects, no browser: `unit` for the instruments and model code in src/, `model` for the
// spec's second seam (docs/spec/increment-1.md, Testing decisions): the World stepped with Rapier
// and no renderer. The first seam, the built site in a browser, is Playwright (playwright.config.ts,
// tests/e2e). React rendering is proven there, so the coverage ratchet below measures only model
// code and instruments, never components.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'model',
          include: ['tests/model/**/*.test.ts'],
          environment: 'node',
          hookTimeout: 20_000, // Rapier's wasm initialises in beforeAll, once per file
        },
      },
    ],
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
