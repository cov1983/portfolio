import { expect, test } from './fixtures'

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
    const bio = content.bioHtml
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 40)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(content.oneLine)).toBeVisible()
    await expect(page.getByText(bio)).toHaveCount(0)
    await page.goto('/exhibits')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(bio)).toHaveCount(1)
  })
})
