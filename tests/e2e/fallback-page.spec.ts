import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { expect, test, textOf } from './fixtures'

// Seam 1 at `/exhibits`: the pre-rendered Fallback Page (spec: Fallback Page; ADR 0004, ADR 0010).
// The first case is plan §2's verification that the clean URL serves exhibits/index.html.
test('the preview serves the Fallback Page at /exhibits', async ({ page, content }) => {
  await page.goto('/exhibits')
  await expect(page).toHaveTitle(`Exhibits — ${content.owner.name}`)
})

// US-19: everything the World holds, as a plain page, without script.
test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  test('shows every Exhibit in full under its own anchor (AC-19.1)', async ({ page, content }) => {
    await page.goto('/exhibits')
    for (const exhibit of content.exhibits) {
      const article = page.locator(`[id="${exhibit.id}"]`)
      await expect(article.getByRole('heading', { level: 2 })).toHaveText(exhibit.title)
      await expect(article).toContainText(exhibit.hook)
      await expect(article).toContainText(textOf(exhibit.summaryHtml))
      await expect(article).toContainText(exhibit.role)
      for (const item of exhibit.tech) await expect(article).toContainText(item)
      await expect(article).toContainText(exhibit.year)
      for (const link of exhibit.links) {
        await expect(article.getByRole('link', { name: link.label })).toHaveAttribute(
          'href',
          link.url,
        )
      }
      for (const image of exhibit.images) {
        await expect(article.getByRole('img', { name: image.alt })).toHaveAttribute(
          'src',
          image.fallback,
        )
      }
      await expect(article).toContainText(textOf(exhibit.whatIdDoDifferentlyHtml))
    }
  })

  test('offers each image as AVIF and WebP at three widths with a fallback (AC-27.1)', async ({
    page,
    content,
  }) => {
    await page.goto('/exhibits')
    for (const exhibit of content.exhibits) {
      for (const image of exhibit.images) {
        const picture = page.locator('picture', {
          has: page.locator(`img[src="${image.fallback}"]`),
        })
        await expect(picture).toHaveCount(1)
        for (const source of image.sources) {
          const element = picture.locator(`source[type="${source.type}"]`)
          await expect(element).toHaveAttribute('srcset', source.srcset)
          await expect(element).toHaveAttribute('sizes', image.sizes)
          expect(source.srcset.match(/ \d+w/g)).toHaveLength(3)
        }
      }
    }
  })

  test('shows the Bio from bio.md (AC-26.4)', async ({ page, content }) => {
    await page.goto('/exhibits')
    const bio = page.locator('#bio')
    await expect(bio.getByRole('heading', { level: 2 })).toHaveText('Bio')
    await expect(bio).toContainText(textOf(content.bioHtml))
  })

  test('shows the Contact (AC-19.1)', async ({ page }) => {
    await page.goto('/exhibits')
    const contact = page.locator('#contact')
    await expect(contact.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(contact.getByRole('link', { name: 'E-mail' })).toBeVisible()
  })

  test('links back to the Title Screen (AC-19.1)', async ({ page, content }) => {
    await page.goto('/exhibits')
    await page.getByRole('link', { name: 'Back to the Title Screen' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.owner.name)
  })

  test('lists the same Exhibits as the Title Screen (AC-19.3)', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page
      .getByRole('navigation', { name: 'Exhibits' })
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    const listed = hrefs.map((href) => href.replace(/^\/exhibits#/, '')).sort()
    await page.goto('/exhibits')
    const anchored = (
      await page
        .locator('main article[id]')
        .evaluateAll((articles) => articles.map((article) => article.id))
    ).sort()
    expect(listed.length).toBeGreaterThan(0)
    expect(anchored).toEqual(listed)
  })
})

// AC-19.2: navigable by headings and landmarks, every image with alternative text. axe needs
// script to run, so these cases use a script-enabled context on a page that ships no script.
test.describe('for assistive technology', () => {
  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('/exhibits')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('is one h1 with an h2 per Exhibit, for the Bio and for the Contact', async ({
    page,
    content,
  }) => {
    await page.goto('/exhibits')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      ...content.exhibits.map((exhibit) => exhibit.title),
      'Bio',
      'Contact',
    ])
  })

  test('has main and nav landmarks', async ({ page }) => {
    await page.goto('/exhibits')
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('navigation')).toHaveCount(1)
  })

  // AC-19.2 as amended (#100 comment 6706618031): every image has an alt attribute; a content
  // image has alternative text; a decorative one an empty one. The one decorative image is the
  // header mark, named by its fixed src (src/site/Mark.tsx); every other image counts as content,
  // so a later picture outside the Exhibits (the Bio's, say) with an empty alt fails here.
  const MARK_SRC = '/favicon.svg'
  /** Every image on the page: its src and its alt attribute (null when absent). */
  const imagesOf = (page: Page) =>
    page
      .locator('img')
      .evaluateAll((images) =>
        images.map((image) => ({ src: image.getAttribute('src'), alt: image.getAttribute('alt') })),
      )

  test('gives every image an alt attribute', async ({ page }) => {
    await page.goto('/exhibits')
    const images = await imagesOf(page)
    expect(images.length).toBeGreaterThan(0)
    expect(images.filter((image) => image.alt === null)).toEqual([])
  })

  test('gives every content image alternative text', async ({ page }) => {
    await page.goto('/exhibits')
    const content = (await imagesOf(page)).filter((image) => image.src !== MARK_SRC)
    expect(content.length).toBeGreaterThan(0)
    expect(content.filter((image) => (image.alt ?? '').trim() === '')).toEqual([])
  })
})
