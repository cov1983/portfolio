import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { TITLE_SCREEN_INTERACTIVE_MARK } from '../../src/perf/marks'
import { expect, expectRecorded, recorded, test } from './fixtures'

// Seam 1 at `/`: the pre-rendered Title Screen (ADR 0010). The World preloads behind it after
// hydration (world.spec.ts); without script nothing of it is requested or mounted.
test('the Title Screen shows the Owner’s name as its level-1 heading', async ({
  page,
  content,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.owner.name)
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

  test('mounts no canvas and requests no world chunk', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(urls.filter((url) => /\/assets\/world-/i.test(url))).toEqual([])
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

// T5a (AC-1.1's mark half; ADR 0010): the pre-rendered markup hydrates, the handlers exist and
// the title-screen-interactive mark is recorded. The shared fixture is the mismatch proof: the
// production React build reports a hydration mismatch as error #418 through reportError, which
// reaches the page as an uncaught error (never console.error, which is the dev build's channel),
// and the fixture fails the test on it; the negative case below shows it in each browser.
test.describe('hydration', () => {
  const wayIn = (page: Page) =>
    page.getByRole('button', { name: /Enter the World|Loading the World/ })

  test('hydrates the pre-rendered Title Screen and records the title-screen-interactive mark (AC-1.1)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
  })

  test('a hydration mismatch is caught by the shared fixture as a page error', async ({
    page,
    problems,
  }) => {
    // The real document with the level-1 heading's text altered: the client tree renders the
    // Owner's name, the server markup says otherwise, React 19 reports #418 (a text mismatch).
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch()
        const body = (await response.text()).replace('<h1>', '<h1>Not ')
        expect(body).toContain('<h1>Not ')
        await route.fulfill({ response, body })
      },
    )
    await page.goto('/')
    await expectRecorded(problems, 'pageerror', 'Minified React error #418')
  })

  test('the way-in control is enabled after hydration and not loading', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
    await expect(wayIn(page)).toBeEnabled()
    await expect(wayIn(page)).not.toHaveAttribute('aria-busy')
  })

  // The way-in's loading state and Enter through the key router are world-entry.spec.ts's
  // AC-1.3 and AC-4.2 cases: once the World preloads, "loading" alone is a race with the chunk.

  test('Enter with a list entry focused follows the link instead', async ({ page, content }) => {
    const [exhibit] = content.exhibits
    if (exhibit === undefined) throw new Error('the content has no Exhibit')
    await page.goto('/')
    await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
    await page
      .getByRole('navigation', { name: 'Exhibits' })
      .getByRole('link', { name: exhibit.title })
      .focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/exhibits#${exhibit.id}$`))
  })
})
