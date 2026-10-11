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

// AC-10.1, seam 1 half: Hub → Path → Zone → Goal is one continuous run. The Goal's placeholder
// status line (T2; T7 opens the Exhibit Panel instead) is the observable end of the run; "no
// loading" is no script fetched after the World was playable and no busy or progress element.
// CI renders in software and the scene steps the model at most four times per frame, so the run
// takes longer than its 6 s of model time; the wait is generous rather than the check weakened.
test('driving up from the Hub reaches the Goal without any loading', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?world')
  await expect
    .poll(() =>
      page.evaluate(
        (name) => performance.getEntriesByName(name, 'mark').length,
        WORLD_PLAYABLE_MARK,
      ),
    )
    .toBe(1)
  const scriptsAfterPlayable: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scriptsAfterPlayable.push(request.url())
  })
  await page.keyboard.down('ArrowUp')
  await expect(page.getByRole('status')).toHaveText('Goal', { timeout: 90_000 })
  await page.keyboard.up('ArrowUp')
  expect(scriptsAfterPlayable).toEqual([])
  await expect(page.locator('[aria-busy="true"], [role="progressbar"]')).toHaveCount(0)
})
