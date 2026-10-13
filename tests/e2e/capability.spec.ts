import { TITLE_SCREEN_INTERACTIVE_MARK } from '../../src/perf/marks'
import { expect, recorded, test } from './fixtures'

// AC-21.2 (spec: Devices and capability): before hydration no hint is present and the way into
// the World is; detection (T8b) only ever adds a `data-hint` element and may move the Fallback
// link first. A no-script context is the Title Screen before hydration.
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

// T5a detects the coarse pointer after hydration and renders nothing from it: the hint is T8b's.
test.describe('the Title Screen after hydration', () => {
  test('still has no hint and the way into the World enabled', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
    await expect(page.locator('[data-hint]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter the World' })).toBeEnabled()
  })
})
