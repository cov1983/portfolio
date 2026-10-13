import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { TITLE_SCREEN_INTERACTIVE_MARK } from '../../src/perf/marks'
import { expect, recorded, test } from './fixtures'

// Seam 1, the way in and out (spec: Entering the World; plan §2, Entry and preload policy): the
// Title Screen hydrates, the World mounts paused and hidden behind it, Enter, Space or the way-in
// control shows it, Escape hides it again, paused, and Enter resumes it. Presence, visibility and
// focus only, never WebGL output (CI renders in software).
const WORLD_CHUNK = /\/assets\/world-.*\.js$/i

const wayIn = (page: Page) =>
  page.getByRole('button', { name: /Enter the World|Loading the World/ })
/** The World container: a section named World, focusable, inert and invisible while hidden. */
const worldContainer = (page: Page) => page.locator('section[aria-label="World"]')
const titleScreen = (page: Page) => page.locator('main.title-screen')

async function hydrated(page: Page): Promise<void> {
  await page.goto('/')
  await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
}

async function entered(page: Page): Promise<void> {
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeVisible()
}

/** Entry began: the way-in shows loading, or the World is already there (the chunk may have arrived). */
async function expectEntryBegun(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await wayIn(page).getAttribute('aria-busy')) === 'true' ||
        (await worldContainer(page).isVisible()),
    )
    .toBe(true)
}

test.describe('entry (AC-1.3)', () => {
  test('Enter begins entry into the World', async ({ page }) => {
    await hydrated(page)
    await page.keyboard.press('Enter')
    await expectEntryBegun(page)
  })

  test('Space begins entry into the World', async ({ page }) => {
    await hydrated(page)
    await page.keyboard.press('Space')
    await expectEntryBegun(page)
  })

  test('the way-in control begins entry with a pointer', async ({ page }) => {
    await hydrated(page)
    await wayIn(page).click()
    await expectEntryBegun(page)
  })
})

// AC-4.2: the chunk is held until the loading state is seen, then released; the World appears
// without a second press.
test('Enter during loading shows loading and enters on readiness without a second press (AC-4.2)', async ({
  page,
}) => {
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(WORLD_CHUNK, async (route) => {
    await held
    await route.continue()
  })
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(wayIn(page)).toHaveAttribute('aria-busy', 'true')
  await expect(worldContainer(page)).toBeHidden()
  release()
  await expect(worldContainer(page)).toBeVisible()
  await expect(worldContainer(page)).toBeFocused()
})

test('after entry the World container is visible and focused, the Title Screen hidden (AC-5.1 wiring)', async ({
  page,
}) => {
  await entered(page)
  await expect(worldContainer(page)).toBeFocused()
  await expect(titleScreen(page)).toBeHidden()
})

test('Escape shows the Title Screen and hides the paused World, which stays mounted (AC-6.1)', async ({
  page,
}) => {
  await entered(page)
  await page.keyboard.press('Escape')
  await expect(titleScreen(page)).toBeVisible()
  await expect(worldContainer(page)).toBeHidden()
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('Enter after Escape resumes the World where it was, with no loading (AC-6.2)', async ({
  page,
}) => {
  await entered(page)
  await page.keyboard.press('Escape')
  await expect(titleScreen(page)).toBeVisible()
  await expect(wayIn(page)).toHaveText('Enter the World')
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeVisible()
  await expect(worldContainer(page)).toBeFocused()
  await expect(page.locator('canvas')).toHaveCount(1)
})

// AC-12.2: the overlay's Reset control does the same Reset as R and hands focus back to the World
// container, so the next key goes to the World and not to the control (Space on a focused button
// would activate it again; here it reaches the key router, which ignores it in the World).
test.describe('the World overlay', () => {
  test('the Reset control returns focus to the World container; the next key is the World’s (AC-12.2)', async ({
    page,
  }) => {
    await entered(page)
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(worldContainer(page)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(worldContainer(page)).toBeVisible()
    await expect(worldContainer(page)).toBeFocused()
    await expect(wayIn(page)).toBeHidden()
  })

  test('shows a one-line key legend naming the arrows or WASD, R and Esc', async ({ page }) => {
    await entered(page)
    const legend = worldContainer(page).locator('.key-legend')
    await expect(legend).toBeVisible()
    await expect(legend).toContainText(/arrows/i)
    await expect(legend).toContainText(/WASD/)
    await expect(legend).toContainText(/\bR\b/)
    await expect(legend).toContainText(/Esc/)
  })

  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await entered(page)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})
