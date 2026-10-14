import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  entered,
  expect,
  hydrated,
  recorded,
  test,
  titleScreen,
  wayIn,
  WORLD_CHUNK,
  worldContainer,
} from './fixtures'

// Seam 1, the way in and out (spec: Entering the World; plan §2, Entry and preload policy): the
// Title Screen hydrates, the World mounts paused and hidden behind it, Enter, Space or the way-in
// control shows it, Escape hides it again, paused, and Enter resumes it. Presence, visibility and
// focus only, never WebGL output (CI renders in software).

/**
 * Entry began: the way-in shows loading, or the World is already there (the chunk may have arrived).
 * Non-waiting reads only (#46): once the World shows, the hidden Title Screen takes the way-in out
 * of the page's roles, and an auto-waiting read of it would block the poll until its timeout.
 */
async function expectEntryBegun(page: Page): Promise<void> {
  const loading = wayIn(page).and(page.locator('[aria-busy="true"]'))
  await expect
    .poll(async () => (await loading.isVisible()) || (await worldContainer(page).isVisible()))
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

  // #46: when the preload has finished before the press, entry shows the World at once and the
  // Title Screen is hidden before the first check, so the way-in is gone from the page's roles.
  test('the way-in control enters a World that is already ready', async ({ page }) => {
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
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

test('Enter after Escape resumes the World without loading (AC-6.2)', async ({ page }) => {
  await entered(page)
  await page.keyboard.press('Escape')
  await expect(wayIn(page)).toHaveText('Enter the World')
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeVisible()
})

test('the resumed World has keyboard focus again (AC-6.2, Focus handling)', async ({ page }) => {
  await entered(page)
  await page.keyboard.press('Escape')
  await expect(titleScreen(page)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeFocused()
})

// AC-12.2: the overlay's Reset control does the same Reset as R and hands focus back to the World
// container, so the next key goes to the World and not to the control (Space on a focused button
// would activate it again; here it reaches the key router, which ignores it in the World). That
// the steering keys still work after the control is world.spec.ts's drive to the Goal, which
// starts with the control.
test.describe('the World overlay', () => {
  test('the Reset control returns focus to the World container (AC-12.2)', async ({ page }) => {
    await entered(page)
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(worldContainer(page)).toBeFocused()
  })

  test('a key after the Reset control goes to the World, not to the control (AC-12.2)', async ({
    page,
  }) => {
    await entered(page)
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(worldContainer(page)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(worldContainer(page)).toBeFocused()
    await expect(titleScreen(page)).toBeHidden()
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
