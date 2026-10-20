import type { Page } from '@playwright/test'

import { TITLE_SCREEN_INTERACTIVE_MARK } from '../../src/perf/marks'
import {
  expect,
  expectRecorded,
  failureScreen,
  hydrated,
  expectRequestedAfter,
  recorded,
  test,
  wayIn,
  WORLD_CHUNK,
} from './fixtures'

// Seam 1, devices and capability (spec US-21, US-22; plan §6 rows 21.1, 21.2, 22.1, corrected by
// #33): detection runs after hydration and only ever adds a `data-hint` paragraph at the top of
// the Title Screen and moves the Fallback Page link first; the way into the World stays visible
// and enabled. Before hydration nothing of it is in the markup (AC-21.2).
//
// Q5 (plan §12), how each Playwright browser emulates a coarse pointer, answered on 2026-10-20
// against the installed Playwright 1.64 browsers: `hasTouch: true` makes `(pointer: coarse)`
// match in Chromium, Firefox (headed under Xvfb, as this project runs it) and WebKit, so every
// project uses the browser's own emulation; Chromium and WebKit add `isMobile: true` (the device
// descriptor the plan named), Firefox does not get it, since its documentation calls the option
// unsupported there. The fallback the plan kept for a browser without such emulation is an init
// script that wraps `window.matchMedia` and answers `matches: true` for `(pointer: coarse)` alone
// (world.spec.ts uses that stub in all three browsers to prove the preload policy, where the
// detection itself is not the point); it is not needed in any of the three.

/** Whether the first link of the page is the Fallback Page's (AC-21.1, 22.1: placed first). */
async function expectFallbackLinkFirst(page: Page): Promise<void> {
  await expect(page.getByRole('link').first()).toHaveAttribute('href', '/exhibits')
}

test.describe('the Title Screen before hydration', () => {
  test.use({ javaScriptEnabled: false })

  test('has no hint and the way into the World (AC-21.2)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-hint]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter the World' })).toBeVisible()
  })

  test('does not place the Fallback Page link first', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link').first()).not.toHaveAttribute('href', '/exhibits')
  })
})

// A fine pointer with WebGL, the CI browsers' own case: detection adds nothing.
test.describe('the Title Screen after hydration on a fine pointer with WebGL', () => {
  test('still has no hint and the way into the World enabled', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
    await expect(page.locator('[data-hint]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter the World' })).toBeEnabled()
  })
})

test.describe('with a coarse pointer (AC-21.1)', () => {
  test.use({
    hasTouch: true,
    isMobile: async ({ browserName }, provide) => {
      await provide(browserName !== 'firefox')
    },
  })

  test('shows the keyboard hint, the Fallback link first, the way in enabled', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('[data-hint="keyboard"]')).toHaveText(
      'The World needs a keyboard for now.',
    )
    await expect(page.locator('[data-hint]')).toHaveCount(1)
    await expectFallbackLinkFirst(page)
    await expect(wayIn(page)).toBeVisible()
    await expect(wayIn(page)).toBeEnabled()
  })
})

/**
 * `getContext` answers null for the given kinds before any page script runs, as a browser
 * without those contexts does (plan §6).
 */
async function withoutContexts(page: Page, kinds: readonly string[]): Promise<void> {
  await page.addInitScript((denied: readonly string[]) => {
    // Read, not called, from the prototype: the wrapper below applies it to the canvas asked.
    const original = Reflect.get(HTMLCanvasElement.prototype, 'getContext')
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...rest: unknown[]
    ) {
      if (denied.includes(id)) return null
      return Reflect.apply(original, this, [id, ...rest]) as RenderingContext | null
    } as typeof original
  }, kinds)
}

// WebGL unavailable: neither `webgl` nor `webgl2`.
test.describe('without WebGL (AC-22.1)', () => {
  test.beforeEach(async ({ page }) => {
    await withoutContexts(page, ['webgl', 'webgl2'])
  })

  test('shows the WebGL hint, the Fallback link first, the way in enabled', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('[data-hint="webgl"]')).toHaveText(
      'The World cannot run here: this browser has no WebGL.',
    )
    await expect(page.locator('[data-hint]')).toHaveCount(1)
    await expectFallbackLinkFirst(page)
    await expect(wayIn(page)).toBeVisible()
    await expect(wayIn(page)).toBeEnabled()
  })

  // Path F of AC-22.2 (world-failure.spec.ts has A–E): the way in stays, the chunk loads on entry
  // (no preload without WebGL, Owner on #33 Q5), three cannot create its context inside the
  // Canvas, the failure boundary catches the throw and the app names it the WebGL failure. three
  // logs its own console line before throwing, consumed here beside App's.
  test('Enter loads the World then and ends on the readable message, kind webgl (AC-22.2)', async ({
    page,
    problems,
  }) => {
    await hydrated(page)
    const pressedAt = await page.evaluate(() => performance.now())
    await page.keyboard.press('Enter')
    await expect(failureScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toContainText('WebGL')
    await expectRequestedAfter(page, WORLD_CHUNK, pressedAt)
    await expectRecorded(problems, 'console.error', 'World failed')
    await expectRecorded(
      problems,
      'console.error',
      'THREE.WebGLRenderer: Error creating WebGL context',
    )
  })
})

// WebGL 1 alone: `webgl` answers, `webgl2` does not (older iOS Safari, a blocklisted driver).
// three 0.186 renders with WebGL 2 only, so the probe in src/app/capability.ts asks for that kind
// alone (ai-review on #64, finding 1; this browser case, round 2, Minor 3): the hint appears as
// without WebGL at all.
test.describe('with WebGL 1 only (AC-22.1)', () => {
  test.beforeEach(async ({ page }) => {
    await withoutContexts(page, ['webgl2'])
  })

  test('shows the WebGL hint, the Fallback link first, the way in enabled', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('[data-hint="webgl"]')).toHaveText(
      'The World cannot run here: this browser has no WebGL.',
    )
    await expect(page.locator('[data-hint]')).toHaveCount(1)
    await expectFallbackLinkFirst(page)
    await expect(wayIn(page)).toBeVisible()
    await expect(wayIn(page)).toBeEnabled()
  })
})
