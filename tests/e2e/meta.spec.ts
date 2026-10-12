import { expect, test } from './fixtures'

// AC-3.1 (spec: Title Screen, US-3): the root fetched without executing script carries a title
// with the Owner's name, a description and a preview image in Open Graph and standard tags, and
// the image is served from the site's own origin.
test.describe('the root fetched without script', () => {
  test.use({ javaScriptEnabled: false })

  test('has a title with the Owner’s name and a description', async ({ page, content }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(new RegExp(content.owner.name))
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      content.oneLine,
    )
  })

  test('has Open Graph and Twitter tags', async ({ page, content }) => {
    await page.goto('/')
    const og = (property: string) => page.locator(`meta[property="og:${property}"]`)
    await expect(og('type')).toHaveAttribute('content', 'website')
    await expect(og('title')).toHaveAttribute('content', content.owner.name)
    await expect(og('description')).toHaveAttribute('content', content.oneLine)
    await expect(og('image')).toHaveAttribute('content', /.+/)
    const twitter = (name: string) => page.locator(`meta[name="twitter:${name}"]`)
    await expect(twitter('card')).toHaveAttribute('content', 'summary_large_image')
    await expect(twitter('title')).toHaveAttribute('content', content.owner.name)
    await expect(twitter('description')).toHaveAttribute('content', content.oneLine)
    await expect(twitter('image')).toHaveAttribute('content', /.+/)
  })

  test('serves the preview image from its own origin', async ({ page, request }) => {
    await page.goto('/')
    const image = await page.locator('meta[property="og:image"]').getAttribute('content')
    const url = new URL(image ?? '', page.url())
    expect(url.origin).toBe(new URL(page.url()).origin)
    const response = await request.get(url.href)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^image\//)
  })
})
