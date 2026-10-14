import type { Page } from '@playwright/test'

import { TITLE_SCREEN_INTERACTIVE_MARK, WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { expect, hydrated, recorded, test, WORLD_CHUNK, worldContainer } from './fixtures'

// Seam 1 at `/` (plan §2, Entry and preload policy; ADR 0010): the World preloads after the
// title-screen-interactive mark and mounts paused behind the Title Screen, where it records
// world-playable from a plain navigation. The mark is the perf gate's instrument (plan §7 line 2);
// this is its canary in the three browsers under the CSP of ADR 0012 (the shared fixture fails
// on any violation). Presence and wiring, never WebGL output.
/** Start times (ms from navigation start) of the World chunk requests, from resource timing. */
function chunkStartTimes(page: Page, pattern: RegExp): Promise<number[]> {
  return page.evaluate(
    (source) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => new RegExp(source, 'i').test(entry.name))
        .map((entry) => entry.startTime),
    pattern.source,
  )
}

function markStart(page: Page, name: string): Promise<number> {
  return page.evaluate((n) => performance.getEntriesByName(n, 'mark')[0]?.startTime ?? -1, name)
}

test('the World mounts a canvas behind the Title Screen after hydration', async ({ page }) => {
  await hydrated(page)
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(worldContainer(page)).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the World records the world-playable mark from a plain navigation (AC-4.1 canary)', async ({
  page,
}) => {
  await page.goto('/')
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
})

test('the world chunk is requested only after the title-screen-interactive mark', async ({
  page,
}) => {
  await page.goto('/')
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  const mark = await markStart(page, TITLE_SCREEN_INTERACTIVE_MARK)
  const starts = await chunkStartTimes(page, WORLD_CHUNK)
  expect(starts.length).toBeGreaterThan(0)
  expect(Math.min(...starts)).toBeGreaterThanOrEqual(mark)
})

// Spec, Architecture: no preload on a coarse pointer; the chunk loads only when the Visitor
// enters. One init-script stub of matchMedia in all three browsers proves the policy (Owner on
// #29, Q6); T8b's hint test uses the browsers' own emulation where the detection itself matters.
test.describe('with a coarse pointer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window)
      window.matchMedia = (query: string): MediaQueryList => {
        const list = original(query)
        if (query !== '(pointer: coarse)') return list
        return new Proxy(list, {
          get: (target, key): unknown =>
            key === 'matches' ? true : (Reflect.get(target, key) as unknown),
        })
      }
    })
  })

  test('withholds the preload; the chunk loads on entry', async ({ page }) => {
    await hydrated(page)
    const pressedAt = await page.evaluate(() => performance.now())
    expect(await recorded(page, WORLD_PLAYABLE_MARK)).toBe(0)
    await page.keyboard.press('Enter')
    await expect(worldContainer(page)).toBeVisible()
    const starts = await chunkStartTimes(page, WORLD_CHUNK)
    expect(starts.length).toBeGreaterThan(0)
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(pressedAt)
  })
})

test('the World requests only same-origin files and no Exhibit media', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.goto('/')
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  const origin = new URL(page.url()).origin
  expect(urls.filter((url) => !url.startsWith(origin))).toEqual([])
  expect(urls.filter((url) => new URL(url).pathname.startsWith('/media/exhibits/'))).toEqual([])
})

// AC-10.1's seam 1 half (the run Hub → Path → Zone → Goal without any loading) is the start of
// exhibit-panel.spec.ts's Goal journey (T7): the run ends on the Exhibit Panel.
