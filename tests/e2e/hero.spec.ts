import { expect, hydrated, test, withoutContexts, WORLD_CHUNK } from './fixtures'

// Seam 1, the hero's backdrop (spec increment-2 AC-2.1, D2; plan §6 row 2.1): static CSS/SVG that
// needs no WebGL and no World bundle. WebGL is taken away before any page script runs and the
// world chunk is aborted, so neither can draw it: what shows is the site's own markup and CSS.
// Presence and visibility only; the composition against the World's play view is the Owner's
// check on the preview.
test.describe('without WebGL and without the World bundle', () => {
  test.beforeEach(async ({ page }) => {
    await withoutContexts(page, ['webgl', 'webgl2'])
    await page.route(WORLD_CHUNK, (route) => route.abort())
  })

  test('the backdrop is shown behind the headline (AC-2.1)', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('.hero-backdrop')).toBeVisible()
  })

  test('the backdrop holds the grid with crosses, the Puck and the edge glow (AC-2.1)', async ({
    page,
  }) => {
    await hydrated(page)
    const backdrop = page.locator('.hero-backdrop')
    await expect(backdrop.locator('.hero-grid .grid-cross')).toHaveCount(1)
    await expect(backdrop.locator('.hero-grid')).toBeVisible()
    await expect(backdrop.locator('.hero-puck img')).toBeVisible()
    await expect(backdrop.locator('.edge-glow')).toBeVisible()
  })

  test('nothing of the World is requested for it (AC-2.1)', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    await hydrated(page)
    await expect(page.locator('.hero-backdrop')).toBeVisible()
    expect(urls.filter((url) => WORLD_CHUNK.test(url))).toEqual([])
  })

  test('the backdrop is hidden from assistive technology', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('.hero-backdrop')).toHaveAttribute('aria-hidden', 'true')
  })
})
