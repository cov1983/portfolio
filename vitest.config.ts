import { defineConfig } from 'vitest/config'

// Three Node projects, no browser: `unit` for the instruments and model code in src/, `model` for the
// spec's second seam (docs/spec/increment-1.md, Testing decisions): the World stepped with Rapier
// and no renderer, and `build` for the first seam's build half (plan §6): the production build
// spawned into the scratch dir and its output checked as text. The first seam proper, the built
// site in a browser, is Playwright (playwright.config.ts, tests/e2e). React rendering is proven
// there, so the coverage ratchet below measures only model code and instruments (plus the perf
// budget and link-check evaluators under scripts/), never components.
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
      include: [
        'src/**/*.ts',
        'build/**/*.ts',
        'scripts/perf/budget.ts',
        'scripts/links/check.ts',
        'scripts/ice/process.ts',
      ],
      exclude: ['**/*.d.ts', '**/*.test.ts', 'build/build.ts', 'build/content-plugin.ts'],
      reporter: ['text', 'lcov'],
      // Ratchet: the floor never moves on its own. `make coverage-ratchet` sets COVERAGE_RATCHET=1,
      // which lets autoUpdate rewrite these numbers to the measured coverage; commit the result.
      // Lowering a number needs an ADR (CLAUDE.md). The floors sit on V8's readings: a Node, Vitest
      // or @vitest/coverage-v8 bump can move branches or statements by a hundredth with no code
      // change, so a `test` failure on a Renovate PR with no src/ change is toolchain drift first;
      // the fix is an ADR lowering the floor to the new reading, never a silent edit here and never
      // a toolchain pin (the #77 review on #76; ADR 0015).
      // ratchet starting floor 80, 2026-10-09; raised by T10 (#35) on 2026-10-21 to the coverage
      // measured at 1bf12bd, increment-1 as shipped (two runs on the new floor agreed; had they
      // differed, the lower reading would have been committed)
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 94.03,
        statements: 99.27,
        autoUpdate: process.env.COVERAGE_RATCHET === '1',
      },
    },
  },
})
