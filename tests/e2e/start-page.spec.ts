import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { expect, hydrated, test, WORLD_CHUNK } from './fixtures'

// Seam 1 at `/start` (spec increment-2: /start, US-5; plan §6 rows 5.1, 5.3, 15.2; ADR 0018): the
// pre-rendered page that ships no script. Expected text comes from the Content the site was built
// from (the `content` fixture), never literals; the section's own copy is the page's, so only its
// heading and the word Invite are named here. AC-5.2 (the document as text) is tests/build's
// start-html.test.ts; AC-5.4 (stores) is privacy.spec.ts; AC-1.1 (tokens) is look.spec.ts.

/** The Discovery Form's chunk (T3a, ADR 0018), by the entry name plan §2 gives it. */
const DISCOVERY_CHUNK = /\/assets\/discovery-[^/]*\.js$/i

test('the preview serves /start at its clean URL', async ({ page, content }) => {
  await page.goto('/start')
  await expect(page).toHaveTitle(`Start a project — ${content.owner.name}`)
})

// AC-5.1: what a Visitor reads with script disabled, in the page's order.
test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  test('shows the Owner’s /start sentence (AC-5.1)', async ({ page, content }) => {
    await page.goto('/start')
    await expect(page.getByRole('main').getByText(content.start.sentence)).toBeVisible()
  })

  test('shows the Contact (AC-5.1)', async ({ page }) => {
    await page.goto('/start')
    const contact = page.locator('#contact')
    await expect(contact.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(contact.getByRole('link', { name: 'E-mail' })).toBeVisible()
  })

  test('explains that the Discovery Form opens with an Invite the Owner sends (AC-5.1)', async ({
    page,
  }) => {
    await page.goto('/start')
    const section = page.locator('#start-a-project')
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Start a project')
    await expect(section).toContainText('Discovery Form')
    await expect(section).toContainText('Invite')
  })
})

/** Every request the page sends from now on, as URLs. */
function requestLog(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

// AC-5.3: from navigation to the load event, neither the World bundle nor the Discovery Form's
// code. The discovery chunk does not exist before T3a, so that half cannot show its red yet; the
// World half's red is the case after it.
test('requests neither the World bundle nor the Discovery Form’s code (AC-5.3)', async ({
  page,
}) => {
  const urls = requestLog(page)
  await page.goto('/start', { waitUntil: 'load' })
  expect(urls.some((url) => new URL(url).pathname === '/start')).toBe(true)
  expect(urls.filter((url) => WORLD_CHUNK.test(url) || DISCOVERY_CHUNK.test(url))).toEqual([])
})

test('the same log sees the World bundle on /, so its absence on /start means something', async ({
  page,
}) => {
  const urls = requestLog(page)
  await hydrated(page)
  await expect.poll(() => urls.some((url) => WORLD_CHUNK.test(url))).toBe(true)
})

// AC-15.2: axe against WCAG 2.2 AA and a keyboard-only pass. axe needs script, so these cases use
// a script-enabled context on a page that ships none (as fallback-page.spec.ts).
test.describe('for assistive technology and the keyboard', () => {
  test('has no WCAG 2.2 AA violations (AC-15.2)', async ({ page }) => {
    await page.goto('/start')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('is one h1 with an h2 for the Contact and for the section', async ({ page }) => {
    await page.goto('/start')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Contact', 'Start a project'])
  })

  // The one nav is the sticky bar's, which replaced the page's own (Owner, #103 comment 6723215733).
  test('has main and nav landmarks', async ({ page }) => {
    await page.goto('/start')
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Site' })).toHaveCount(1)
  })

  test('Tab reaches every link in reading order, each visibly focused (AC-15.2)', async ({
    page,
  }) => {
    await page.goto('/start')
    const reached: { name: string; focusVisible: boolean }[] = []
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      reached.push(
        await page.evaluate(() => {
          const active = document.activeElement
          return {
            name: active?.textContent.trim() ?? '',
            focusVisible: active?.matches(':focus-visible') ?? false,
          }
        }),
      )
    }
    expect(reached).toEqual(
      ['Title Screen', 'Exhibits', 'Start a project', 'GitHub', 'E-mail'].map((name) => ({
        name,
        focusVisible: true,
      })),
    )
  })
})
