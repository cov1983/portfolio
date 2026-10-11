import AxeBuilder from '@axe-core/playwright'

import { expect, test } from './fixtures'

// Seam 1 at `/`: until T4's Title Screen the root is a placeholder, and the `?world` guard keeps
// the World and its chunk away from it (plan §9 risk 10: production never shows work in progress).
test('the root page shows a level-1 heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio')
})

test('the root page mounts no canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('the root page never requests the world chunk', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(urls.filter((url) => /\/assets\/world-/i.test(url))).toEqual([])
})

test('the root page has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
