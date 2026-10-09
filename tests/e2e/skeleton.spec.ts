import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/world-playable'

// Phase 0b skeleton checks: presence and wiring of the built page, never WebGL output.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the built root page shows the skeleton heading', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio: toolchain skeleton')
})

test('the built root page mounts a canvas', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible()
})

test('the first rendered frame records the world-playable mark', async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(
        (name) => performance.getEntriesByName(name, 'mark').length,
        WORLD_PLAYABLE_MARK,
      ),
    )
    .toBe(1)
})

test('the built root page has no WCAG 2.2 AA violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
