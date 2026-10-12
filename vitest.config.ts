import { defineConfig } from 'vitest/config'

// Three Node projects, no browser: `unit` for the instruments and model code in src/, `model` for the
// spec's second seam (docs/spec/increment-1.md, Testing decisions): the World stepped with Rapier
// and no renderer, and `build` for the first seam's build half (plan §6): the production build
// spawned into the scratch dir and its output checked as text. The first seam proper, the built
// site in a browser, is Playwright (playwright.config.ts, tests/e2e). React rendering is proven
// there, so the coverage ratchet below measures only model code and instruments (plus the perf
// budget evaluator under scripts/), never components.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'build/**/*.test.ts', '*.test.ts'],
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
      {
        test: {
          name: 'build',
          include: ['tests/build/**/*.test.ts'],
          environment: 'node',
          hookTimeout: 120_000, // the production build runs in beforeAll, once per file
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Scope (plan §6): model code and instruments under src/, the pure build modules under
      // build/ and the perf evaluator. Every *.tsx (src/main.tsx, src/entry-prerender.tsx,
      // components) is outside through the include pattern: seam 1 proves rendering. build/build.ts
      // (I/O glue) and build/content-plugin.ts (Vite glue) are outside by name.
      include: ['src/**/*.ts', 'build/**/*.ts', 'scripts/perf/budget.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts', 'build/build.ts', 'build/content-plugin.ts'],
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
