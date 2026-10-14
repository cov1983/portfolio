import { defineConfig, devices } from '@playwright/test'

// Spec seam 1 (docs/spec/increment-1.md, Testing decisions): the site built as for production,
// driven in Chromium, Firefox and WebKit with axe against WCAG 2.2 AA. Chromium and WebKit run
// headless; Firefox runs headed under Xvfb (see its project). CI renders WebGL in software, so this
// seam proves presence and wiring of the World, never its rendered output.
const port = 4173
const baseURL = `http://localhost:${String(port)}`

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // A failed test keeps its trace, which the HTML report (CI's playwright-report artifact) carries:
  // #46 had only error contexts to diagnose from.
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Headless Firefox has no WebGL at all on a machine without a GPU (verified 2026-10-09 with
        // every software-GL pref). Headed Firefox gets Mesa's llvmpipe, so this project runs headed;
        // `make test-e2e` wraps Playwright in xvfb-run where that exists (CI, devcontainer).
        // Chromium (SwiftShader) and WebKit fall back to software rendering on their own.
        headless: false,
        launchOptions: {
          firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.forbid-software': false },
        },
      },
      // #46: headed Firefox renders through Mesa's llvmpipe on the CI runner, and the World's first
      // frame (the world-playable mark) took 1.1–3.9 s in passing runs and over 5 s in two failing
      // CI runs while other workers loaded the machine. Every Firefox expect gets 15 s; Chromium and
      // WebKit keep the 5 s default.
      expect: { timeout: 15_000 },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // `make test-e2e` builds dist/ first; this only serves it.
    command: `pnpm exec vite preview --port ${String(port)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
  },
})
