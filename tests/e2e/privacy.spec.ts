import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  exhibitPanel,
  expect,
  firstExhibit,
  hydrated,
  listEntry,
  opened,
  recorded,
  test,
  textOf,
} from './fixtures'

// US-20 (spec: Fallback Page): the Contact on both pre-rendered documents, the e-mail address
// obfuscated against scraping, the GitHub profile in a new tab, the Bio on the Fallback Page only.
const PAGES = ['/', '/exhibits']

function decodeDecimalReferences(text: string): string {
  return text.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

test('neither document’s source contains a plain mailto: (AC-20.1)', async ({ request }) => {
  for (const path of PAGES) {
    const html = await (await request.get(path)).text()
    expect(html, path).not.toContain('mailto:')
  }
})

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of PAGES) {
    test(`${path}: the e-mail link opens the mail client with the Owner’s address (AC-20.1)`, async ({
      page,
      content,
    }) => {
      await page.goto(path)
      const link = page.locator('a[href^="mailto:"]')
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute(
        'href',
        decodeDecimalReferences(content.contact.emailHrefEntities),
      )
    })

    test(`${path}: the GitHub link opens the Owner’s profile in a new tab (AC-20.2)`, async ({
      page,
      content,
    }) => {
      await page.goto(path)
      const link = page.getByRole('link', { name: 'GitHub' })
      await expect(link).toHaveAttribute('href', content.contact.github)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/)
    })
  }

  test('the Contact is on both pages, the one line on the Title Screen, the Bio on the Fallback Page only (AC-20.3)', async ({
    page,
    content,
  }) => {
    const bio = textOf(content.bioHtml).slice(0, 40)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(content.oneLine)).toBeVisible()
    await expect(page.getByText(bio)).toHaveCount(0)
    await page.goto('/exhibits')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(bio)).toHaveCount(1)
  })
})

// US-17 (spec: Exhibit Panel): Exhibit media cost nothing until a Panel opens (AC-17.1), and in the
// Panel the images come from the site's origin at a size for the viewport (AC-17.3). The video's
// markup is proven on the build seam (tests/build/content-build.test.ts, AC-17.2); its browser
// half waits for the first Exhibit with a video (#52).
const EXHIBIT_MEDIA = '/media/exhibits/'

/** Every request URL from now on, in the order the page made them. */
function requestLog(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    urls.push(request.url())
  })
  return urls
}

test.describe('Exhibit media', () => {
  test('nothing under /media/exhibits/ is requested before a Panel opens, the World loaded included (AC-17.1)', async ({
    page,
  }) => {
    const urls = requestLog(page)
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    expect(urls.filter((url) => new URL(url).pathname.startsWith(EXHIBIT_MEDIA))).toEqual([])
  })

  test('opening a Panel requests its media, so the log above would see them', async ({
    page,
    content,
  }) => {
    const urls = requestLog(page)
    await hydrated(page)
    await listEntry(page, firstExhibit(content).title).click()
    await expect
      .poll(() => urls.some((url) => new URL(url).pathname.startsWith(EXHIBIT_MEDIA)))
      .toBe(true)
  })

  test('each picture source in the Panel is same-origin, with three widths and sizes (AC-17.3)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    const sources = exhibitPanel(page).locator('picture source')
    await expect(sources).toHaveCount(exhibit.images.length * 2)
    const read = await sources.evaluateAll((elements) =>
      elements.map((element) => ({
        srcset: element.getAttribute('srcset') ?? '',
        sizes: element.getAttribute('sizes') ?? '',
      })),
    )
    for (const { srcset, sizes } of read) {
      const candidates = srcset.split(',').map((candidate) => candidate.trim().split(/\s+/))
      expect(candidates.map(([, width]) => width)).toEqual([
        expect.stringMatching(/^\d+w$/),
        expect.stringMatching(/^\d+w$/),
        expect.stringMatching(/^\d+w$/),
      ])
      for (const [url] of candidates) {
        expect(new URL(url ?? '', page.url()).origin).toBe(new URL(page.url()).origin)
      }
      expect(sizes).not.toBe('')
    }
  })

  test('each image fallback in the Panel is same-origin (AC-17.3)', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    const sources = await exhibitPanel(page)
      .locator('picture img')
      .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
    expect(sources).not.toEqual([])
    for (const source of sources) {
      expect(new URL(source).origin).toBe(new URL(page.url()).origin)
    }
  })
})
