import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { expect, test } from './fixtures'

// Seam 1 at `/?world` (plan §9 risk 10): presence and wiring of the World, never WebGL output.
// The mark is the perf gate's instrument (plan §7 line 2); this is its canary in the three
// browsers under the CSP of ADR 0012 (the shared fixture fails on any violation), the first proof
// of Rapier's wasm under `'wasm-unsafe-eval'` outside Chromium.
test('the World mounts a canvas at /?world', async ({ page }) => {
  await page.goto('/?world')
  await expect(page.locator('canvas')).toBeVisible()
})

test('the World records the world-playable mark once it is ready', async ({ page }) => {
  await page.goto('/?world')
  await expect
    .poll(() =>
      page.evaluate(
        (name) => performance.getEntriesByName(name, 'mark').length,
        WORLD_PLAYABLE_MARK,
      ),
    )
    .toBe(1)
})

test('the World requests only same-origin files and no Exhibit media', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.goto('/?world')
  await expect
    .poll(() =>
      page.evaluate(
        (name) => performance.getEntriesByName(name, 'mark').length,
        WORLD_PLAYABLE_MARK,
      ),
    )
    .toBe(1)
  const origin = new URL(page.url()).origin
  expect(urls.filter((url) => !url.startsWith(origin))).toEqual([])
  expect(urls.filter((url) => new URL(url).pathname.startsWith('/media/exhibits/'))).toEqual([])
})
