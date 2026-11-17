import { expect, hydrated, test, withoutContexts, WORLD_CHUNK } from './fixtures'

// Seam 1, the hero (spec increment-2 US-2, AC-1.2, D6; plan §6 row 2.1): the headline with the
// static blue edge glow, a CSS radial gradient on the hero element from the glow token, with no
// image, no mask and no element of its own, and nothing of WebGL or the World bundle. WebGL is
// taken away before any page script runs and the world chunk is aborted, so neither can draw it.
// The grid backdrop of AC-2.1 is handed off (Owner, #103 comment 6728114096). Presence and wiring
// only; the look is the Owner's check on the preview.
test.describe('without WebGL and without the World bundle', () => {
  test.beforeEach(async ({ page }) => {
    await withoutContexts(page, ['webgl', 'webgl2'])
    await page.route(WORLD_CHUNK, (route) => route.abort())
  })

  // Red: the hero without its gradient (background-image none).
  test('the hero carries the edge glow as a radial gradient (AC-1.2)', async ({ page }) => {
    await hydrated(page)
    const image = await page
      .locator('header.hero')
      .evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(image).toMatch(/^radial-gradient\(/)
  })

  // Red: a url() layer added to the hero's background (ai-review round 1 on #125, m5: split from
  // the mask case).
  test('the glow uses no image', async ({ page }) => {
    await hydrated(page)
    const image = await page
      .locator('header.hero')
      .evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(image).not.toContain('url(')
  })

  // Red: a mask-image added to the hero.
  test('the glow uses no mask', async ({ page }) => {
    await hydrated(page)
    const mask = await page
      .locator('header.hero')
      .evaluate((element) => getComputedStyle(element).maskImage)
    expect(mask).toBe('none')
  })

  test('nothing of the World is requested for the hero', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    await hydrated(page)
    await expect(page.locator('header.hero')).toBeVisible()
    expect(urls.filter((url) => WORLD_CHUNK.test(url))).toEqual([])
  })

  // The handed-off backdrop leaves no image request on `/` beyond the mark's.
  test('the Title Screen requests no image but the mark', async ({ page }) => {
    const images: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'image') images.push(new URL(request.url()).pathname)
    })
    await hydrated(page)
    expect([...new Set(images)]).toEqual(['/favicon.svg'])
  })
})
