import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  expect,
  hydrated,
  recorded,
  test,
  titleScreenLayer,
  transitionEnded,
  worldContainer,
} from './fixtures'

// Seam 1, the sticky bar (spec increment-2 US-3, AC-3.1–3.4, AC-4.3; plan §6 rows 3.1–3.4, T0b's
// pages; /start/discovery joins in T3a). A 320 × 480 viewport, so every page scrolls (each test
// that scrolls checks it did, or a bar that is merely at the top would pass) and the bar is read
// at the narrowest width increment-1 promises (AC-16.2). Presence, place and wiring only.
test.use({ viewport: { width: 320, height: 480 } })

const PAGES = ['/', '/exhibits', '/start'] as const

const bar = (page: Page): Locator => page.locator('.sticky-bar')
const barLink = (page: Page, name: string): Locator =>
  page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name, exact: true })

for (const path of PAGES) {
  test.describe(`on ${path}`, () => {
    test('stays in view when the page is scrolled to its end (AC-3.1)', async ({ page }) => {
      await page.goto(path)
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight)
      })
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      await expect(bar(page)).toBeInViewport()
    })

    test('holds the mark first (AC-3.1)', async ({ page }) => {
      await page.goto(path)
      const first = await bar(page).evaluate((element) => {
        const child = element.firstElementChild
        return child?.matches('img') === true || child?.querySelector('img') !== null
      })
      expect(first).toBe(true)
    })

    test('leads to the Exhibits and to /start (AC-3.1)', async ({ page }) => {
      await page.goto(path)
      await expect(barLink(page, 'Exhibits')).toHaveAttribute('href', '/exhibits')
      await expect(barLink(page, 'Start a project')).toHaveAttribute('href', '/start')
    })

    test(`marks "Start a project" as the current page only on /start (AC-3.2)`, async ({
      page,
    }) => {
      await page.goto(path)
      const start = barLink(page, 'Start a project')
      if (path === '/start') await expect(start).toHaveAttribute('aria-current', 'page')
      else await expect(start).not.toHaveAttribute('aria-current')
    })
  })
}

// The mark leads to the Title Screen on /exhibits and /start, and is plain on `/` (Owner, #103
// comment 6723215733).
test.describe('the mark', () => {
  test('is no link on the Title Screen', async ({ page }) => {
    await page.goto('/')
    await expect(bar(page).getByRole('link', { name: 'Title Screen' })).toHaveCount(0)
  })

  for (const path of ['/exhibits', '/start']) {
    test(`leads to the Title Screen on ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(bar(page).getByRole('link', { name: 'Title Screen' })).toHaveAttribute(
        'href',
        '/',
      )
    })
  }
})

// AC-3.3: in the World the bar is hidden with the Title Screen's layer it sits in. Read after the
// crossfade's own `transitionend` (no wait), the World ready before the press.
test.describe('in the World (AC-3.3)', () => {
  async function inTheWorld(page: Page): Promise<void> {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    const faded = await transitionEnded(titleScreenLayer(page), 'visibility')
    await page.keyboard.press('Enter')
    await faded()
    await expect(worldContainer(page)).toBeFocused()
  }

  test('is not visible', async ({ page }) => {
    await inTheWorld(page)
    expect(await bar(page).isHidden()).toBe(true)
  })

  test('is inert', async ({ page }) => {
    await inTheWorld(page)
    expect(await bar(page).evaluate((element) => element.closest('[inert]') !== null)).toBe(true)
  })

  test('is not exposed to assistive technology', async ({ page }) => {
    await inTheWorld(page)
    const snapshot = await page.locator('body').ariaSnapshot()
    expect(snapshot).not.toContain('Start a project')
    expect(snapshot).not.toContain('Exhibits')
  })

  // The World's tab stops are the Reset control and the browser's own; four presses go round them
  // and back, and none lands in the bar.
  test('is never reached by Tab', async ({ page }) => {
    await inTheWorld(page)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      const inBar = await page.evaluate(
        () => document.activeElement?.closest('.sticky-bar') !== null,
      )
      expect(inBar, `Tab ${String(i + 1)}`).toBe(false)
    }
  })
})

test('the Title Screen with its bar has no WCAG 2.2 AA violations after Escape (AC-4.3)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await hydrated(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  const faded = await transitionEnded(titleScreenLayer(page), 'visibility')
  await page.keyboard.press('Enter')
  await faded()
  const back = await transitionEnded(titleScreenLayer(page), 'opacity')
  await page.keyboard.press('Escape')
  await back()
  await expect(bar(page)).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

// AC-3.4: without script the bar's links are plain links and navigate from every page.
test.describe('without script (AC-3.4)', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of PAGES) {
    test(`"Exhibits" navigates from ${path}`, async ({ page }) => {
      await page.goto(path)
      await barLink(page, 'Exhibits').click()
      await expect(page).toHaveURL(/\/exhibits$/)
    })

    test(`"Start a project" navigates from ${path}`, async ({ page }) => {
      await page.goto(path)
      await barLink(page, 'Start a project').click()
      await expect(page).toHaveURL(/\/start$/)
    })
  }

  for (const path of ['/exhibits', '/start']) {
    test(`the mark navigates to the Title Screen from ${path}`, async ({ page }) => {
      await page.goto(path)
      await bar(page).getByRole('link', { name: 'Title Screen' }).click()
      await expect(page).toHaveURL(/\/$/)
    })
  }
})
