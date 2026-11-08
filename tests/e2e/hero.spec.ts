import { expect, hydrated, test, withoutContexts, WORLD_CHUNK } from './fixtures'

const BACKDROP = '/hero-backdrop.svg'

// Seam 1, the hero's backdrop (spec increment-2 AC-2.1, D2; plan §6 row 2.1): a static image that
// needs no WebGL and no World bundle, the SVG the build derives (build/backdrop.ts; Owner, #103
// comment 6726409397) under the unchanged Mark. WebGL is taken away before any page script runs
// and the world chunk is aborted, so neither can draw it: what shows is the site's own markup, CSS
// and that file. Presence, wiring and that the file decodes as an image of its view; the
// composition against the World's play view is the Owner's check on the preview.
test.describe('without WebGL and without the World bundle', () => {
  test.beforeEach(async ({ page }) => {
    await withoutContexts(page, ['webgl', 'webgl2'])
    await page.route(WORLD_CHUNK, (route) => route.abort())
  })

  test('the backdrop is shown behind the headline (AC-2.1)', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('.hero-backdrop')).toBeVisible()
  })

  // Red: a build without the backdrop step serves no /hero-backdrop.svg (404).
  test('the backdrop requests its image from the build, an SVG (AC-2.1)', async ({ page }) => {
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === BACKDROP)
    await hydrated(page)
    const served = await response
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toContain('image/svg+xml')
  })

  test('the backdrop shows that image as its background (AC-2.1)', async ({ page }) => {
    await hydrated(page)
    const image = await page
      .locator('.hero-backdrop')
      .evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(image).toContain(BACKDROP)
  })

  // The browser decodes the file as an image of the 1600 × 900 view: grid, crosses, edge glow
  // and foot fade are in it (their colours: tests/build/tokens.test.ts).
  test('the backdrop image renders in the browser (AC-2.1)', async ({ page }) => {
    await hydrated(page)
    const size = await page.evaluate(async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }, BACKDROP)
    expect(size).toEqual([1600, 900])
  })

  test('the Puck stands over the backdrop (AC-2.1)', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('.hero-backdrop .hero-puck img')).toBeVisible()
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
