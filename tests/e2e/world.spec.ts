import type { Page } from '@playwright/test'

import { TITLE_SCREEN_INTERACTIVE_MARK, WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  expect,
  hydrated,
  ICE_TEXTURE,
  recorded,
  expectRequestedAfter,
  test,
  WORLD_CHUNK,
  worldContainer,
} from './fixtures'

// Seam 1 at `/` (plan §2, Entry and preload policy; ADR 0010): the World preloads after the
// title-screen-interactive mark and mounts paused behind the Title Screen, where it records
// world-playable from a plain navigation. The mark is the perf gate's instrument (plan §7 line 2);
// this is its canary in the three browsers under the CSP of ADR 0012 (the shared fixture fails
// on any violation). Presence and wiring, never WebGL output.
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
  await expectRequestedAfter(
    page,
    WORLD_CHUNK,
    await markStart(page, TITLE_SCREEN_INTERACTIVE_MARK),
  )
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
    await expectRequestedAfter(page, WORLD_CHUNK, pressedAt)
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

/** The end times (ms from navigation start) of the ice texture's requests, from resource timing. */
function iceEndTimes(page: Page): Promise<number[]> {
  return page.evaluate(
    (source) =>
      performance
        .getEntriesByType('resource')
        .filter(
          (entry): entry is PerformanceResourceTiming =>
            entry instanceof PerformanceResourceTiming &&
            new RegExp(source).test(new URL(entry.name).pathname),
        )
        .map((entry) => entry.responseEnd),
    ICE_TEXTURE.source,
  )
}

// The ice texture (#55) is the World's one fetched file besides its chunks: same-origin under
// /assets/, loaded with Rapier, so it counts in the download until playable (plan §7 line 3).
test.describe('the ice texture', () => {
  test('is served once by the site, with 200', async ({ page }) => {
    const statuses: number[] = []
    page.on('response', (response) => {
      if (ICE_TEXTURE.test(new URL(response.url()).pathname)) statuses.push(response.status())
    })
    await page.goto('/')
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    expect(statuses).toEqual([200])
  })

  test('has finished loading before the World is playable', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    const playable = await markStart(page, WORLD_PLAYABLE_MARK)
    const [end] = await iceEndTimes(page)
    expect(end).toBeLessThanOrEqual(playable)
  })
})

// AC-10.1's seam 1 half (the run Hub → Path → Zone → Goal without any loading) is the start of
// exhibit-panel.spec.ts's Goal journey (T7): the run ends on the Exhibit Panel.
