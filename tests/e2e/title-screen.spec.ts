import AxeBuilder from '@axe-core/playwright'

import { expect, test } from './fixtures'

// Seam 1 at `/`: the pre-rendered Title Screen (ADR 0010). The `?world` guard keeps the World and
// its chunk away from the root (plan §9 risk 10: production never shows work in progress).
test('the Title Screen shows the Owner’s name as its level-1 heading', async ({
  page,
  content,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.owner.name)
})

test('the Title Screen mounts no canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('the Title Screen never requests the world chunk', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(urls.filter((url) => /\/assets\/world-/i.test(url))).toEqual([])
})

test('the Title Screen has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
