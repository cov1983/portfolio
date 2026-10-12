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

// AC-1.1's HTML half and AC-1.2, AC-2.3: everything the Title Screen holds is in the pre-rendered
// document and its links work without script.
test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  test('shows the six pieces of the Title Screen (AC-1.1)', async ({ page, content }) => {
    await page.goto('/')
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(content.owner.name)
    await expect(main.getByText(content.oneLine)).toBeVisible()
    await expect(main.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'E-mail' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Enter the World' })).toBeVisible()
    const entries = main.getByRole('navigation', { name: 'Exhibits' }).getByRole('listitem')
    await expect(entries).toHaveCount(content.exhibits.length)
    for (const [i, exhibit] of content.exhibits.entries()) {
      await expect(entries.nth(i).getByRole('link')).toHaveText(exhibit.title)
      await expect(entries.nth(i)).toContainText(exhibit.hook)
    }
    await expect(main.getByRole('link', { name: /plain page/ })).toBeVisible()
  })

  test('the Fallback Page link navigates (AC-1.2)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /plain page/ }).click()
    await expect(page).toHaveURL(/\/exhibits$/)
  })

  test('each Exhibit list entry navigates to its anchor on the Fallback Page (AC-1.2, AC-2.3)', async ({
    page,
    content,
  }) => {
    for (const exhibit of content.exhibits) {
      await page.goto('/')
      await page
        .getByRole('navigation', { name: 'Exhibits' })
        .getByRole('link', { name: exhibit.title })
        .click()
      await expect(page).toHaveURL(new RegExp(`/exhibits#${exhibit.id}$`))
    }
  })
})
