import { readFileSync } from 'node:fs'

import type { Locator, Page } from '@playwright/test'

import {
  entered,
  exhibitPanel,
  expect,
  expectRecorded,
  failureScreen,
  firstExhibit,
  hydrated,
  opened,
  test,
  wayIn,
  WORLD_CHUNK,
  worldContainer,
  type Problem,
} from './fixtures'

// Seam 1 for AC-1.1 (spec increment-2; plan §6 row 1.1, T0a's four surfaces, plus the hints and the
// readable failure T0a re-skins with them): on each, the page's background and the accent of the
// surface's primary control (a hint: its edge) are the two token values. The expected colours are read from
// the token layer itself (src/site/tokens.css), never written here, so the Owner's tuning of a
// value on the preview keeps this test meaningful. /start and the Discovery Form join in T1, T3a.
const TOKENS = readFileSync(new URL('../../src/site/tokens.css', import.meta.url), 'utf8')

/** An opaque token of tokens.css (#rrggbb) as a browser reports a computed colour. */
function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*#([0-9a-f]{6});`, 'i').exec(TOKENS)
  if (match?.[1] === undefined) throw new Error(`tokens.css has no opaque --color-${name}`)
  const hex = match[1]
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16)
  return `rgb(${String(channel(0))}, ${String(channel(2))}, ${String(channel(4))})`
}

const BACKGROUND = token('background')
const PRIMARY = token('primary')

function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

function computed(
  locator: Locator,
  property: 'backgroundColor' | 'color' | 'borderTopColor' | 'borderLeftColor',
) {
  return locator.evaluate((element, name) => getComputedStyle(element)[name], property)
}

test.describe('the Title Screen', () => {
  test('has the background token behind it', async ({ page }) => {
    await hydrated(page)
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  test('fills the way-in control with the accent', async ({ page }) => {
    await hydrated(page)
    expect(await computed(wayIn(page), 'backgroundColor')).toBe(PRIMARY)
  })
})

test.describe('the Exhibit Panel', () => {
  test('has the background token behind it', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  test('fills the Close control with the accent', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    const close = exhibitPanel(page).getByRole('button', { name: 'Close' })
    expect(await computed(close, 'backgroundColor')).toBe(PRIMARY)
  })
})

test.describe('the Fallback Page', () => {
  test('has the background token behind it', async ({ page }) => {
    await page.goto('/exhibits')
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  test('draws its first link in the accent', async ({ page }) => {
    await page.goto('/exhibits')
    const back = page.getByRole('link', { name: 'Back to the Title Screen' })
    expect(await computed(back, 'color')).toBe(PRIMARY)
  })
})

test.describe('the World overlay', () => {
  test('has the background token behind it', async ({ page }) => {
    await entered(page)
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  // The World's canvas background reads the same token (src/world/scene/world.css; ai-review
  // round 1 on #121, finding 2), so a tuned background leaves no seam between site and World.
  test('lays the World on the background token', async ({ page }) => {
    await entered(page)
    expect(await computed(worldContainer(page).locator('.world'), 'backgroundColor')).toBe(
      BACKGROUND,
    )
  })

  test('edges the Reset control with the accent', async ({ page }) => {
    await entered(page)
    const reset = worldContainer(page).getByRole('button', { name: 'Reset' })
    expect(await computed(reset, 'borderTopColor')).toBe(PRIMARY)
  })
})

// The keyboard hint, reached the way capability.spec reaches it: the browser's own coarse-pointer
// emulation (hasTouch; isMobile where the browser supports it).
test.describe('a capability hint', () => {
  test.use({
    hasTouch: true,
    isMobile: async ({ browserName }, provide) => {
      await provide(browserName !== 'firefox')
    },
  })

  test('has the background token behind it', async ({ page }) => {
    await hydrated(page)
    await expect(page.locator('[data-hint]')).toHaveCount(1)
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  test('edges the hint with the accent', async ({ page }) => {
    await hydrated(page)
    expect(await computed(page.locator('[data-hint]'), 'borderLeftColor')).toBe(PRIMARY)
  })
})

/**
 * The readable failure, reached the way world-failure.spec's path A reaches it: the world chunk's
 * requests aborted, Enter. App's one `World failed` line is consumed, and in Chromium alone its own
 * "Failed to load resource" line per aborted request, so an unexpected line still fails the test.
 */
async function failed(page: Page, problems: Problem[], browserName: string): Promise<void> {
  let aborted = 0
  await page.route(WORLD_CHUNK, (route) => {
    aborted += 1
    return route.abort()
  })
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(failureScreen(page)).toBeVisible()
  await expectRecorded(problems, 'console.error', 'World failed')
  if (browserName !== 'chromium') return
  for (let i = 0; i < aborted; i++)
    await expectRecorded(problems, 'console.error', 'Failed to load resource')
}

test.describe('the readable failure', () => {
  test('has the background token behind it', async ({ page, problems, browserName }) => {
    await failed(page, problems, browserName)
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  test('fills the Title Screen control with the accent', async ({
    page,
    problems,
    browserName,
  }) => {
    await failed(page, problems, browserName)
    const back = failureScreen(page).getByRole('button', { name: 'Title Screen' })
    expect(await computed(back, 'backgroundColor')).toBe(PRIMARY)
  })
})
