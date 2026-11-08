import { readFileSync } from 'node:fs'

import type { Locator, Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  caption,
  entered,
  exhibitPanel,
  expect,
  expectRecorded,
  failureScreen,
  firstExhibit,
  hydrated,
  opened,
  recorded,
  test,
  titleScreenLayer,
  transitionEnded,
  wayIn,
  WORLD_CHUNK,
  worldContainer,
  type Problem,
} from './fixtures'

// Seam 1 for AC-1.1 (spec increment-2; plan §6 row 1.1, T0a's four surfaces, plus the hints and the
// readable failure T0a re-skins with them): on each, the page's background and the accent of the
// surface's primary control (a hint: its edge) are the two token values. The expected colours are read from
// the token layer itself (src/site/tokens.css), never written here, so the Owner's tuning of a
// value on the preview keeps this test meaningful. /start joined in T1; the Discovery Form joins in T3a.
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
  property:
    | 'backgroundColor'
    | 'color'
    | 'borderTopColor'
    | 'borderLeftColor'
    | 'outlineColor'
    | 'boxShadow',
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

test.describe('/start', () => {
  test('has the background token behind it', async ({ page }) => {
    await page.goto('/start')
    expect(await bodyBackground(page)).toBe(BACKGROUND)
  })

  // Its own nav went to the sticky bar (Owner, #103 comment 6723215733): the bar's first text link.
  test('draws its first link in the accent', async ({ page }) => {
    await page.goto('/start')
    const exhibits = page.getByRole('navigation', { name: 'Site' }).getByRole('link', {
      name: 'Exhibits',
    })
    expect(await computed(exhibits, 'color')).toBe(PRIMARY)
  })
})

// The sticky bar's primary control (increment-2 AC-3.1, D7): "Start a project" filled with the
// accent on each page that carries the bar.
test.describe('the sticky bar', () => {
  for (const path of ['/', '/exhibits', '/start']) {
    test(`fills "Start a project" with the accent on ${path}`, async ({ page }) => {
      await page.goto(path)
      const start = page.getByRole('navigation', { name: 'Site' }).getByRole('link', {
        name: 'Start a project',
      })
      expect(await computed(start, 'backgroundColor')).toBe(PRIMARY)
    })
  }
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

  // Two-tone focus over the light ice (Owner, #100 comment 6714592319): the accent outline framed
  // by a ring of the background token, reached by keyboard so :focus-visible applies.
  test('frames the focused Reset control in the accent and the background token', async ({
    page,
  }) => {
    await entered(page)
    const reset = worldContainer(page).getByRole('button', { name: 'Reset' })
    await page.keyboard.press('Tab')
    await expect(reset).toBeFocused()
    expect(await computed(reset, 'outlineColor')).toBe(PRIMARY)
    expect(await computed(reset, 'boxShadow')).toContain(BACKGROUND)
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

// AC-1.2 (spec increment-2, D6; plan §6 row 1.2; Owner, #103 comments 6723218035 and 6723304033):
// exactly two effects, the headline reveal and the static blue edge glow. A finished animation
// drops out of `document.getAnimations()` (probe of 2026-11-08, all three engines), so a list
// read after the reveal ended is empty and proves nothing alone: each surface is also swept for
// every shown element whose computed `animation-name` is not `none`, which does not depend on
// timing. Shown means `checkVisibility` with the `visibility` property, so the Title Screen's
// layer, hidden behind the World, is not counted there. Red: before T0b removed it, the World's
// sweep found the caption's `caption-in`.

/** Every shown element with an animation, as `tag.class: name`. */
function animatedElements(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((element) => element.checkVisibility({ visibilityProperty: true }))
      .map((element) => ({ element, name: getComputedStyle(element).animationName }))
      .filter(({ name }) => name !== 'none')
      .map(
        ({ element, name }) =>
          `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}: ${name}`,
      ),
  )
}

/** The names of the document's current animations; CSS transitions are the crossfade's, not effects. */
function currentAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation)
      .map((animation) => animation.animationName),
  )
}

test.describe('exactly two effects (AC-1.2)', () => {
  test('on the Title Screen only the headline animates, its reveal', async ({ page }) => {
    await hydrated(page)
    expect(await animatedElements(page)).toEqual(['div.headline: headline-reveal'])
    for (const name of await currentAnimations(page)) expect(name).toBe('headline-reveal')
  })

  test('the edge glow is static', async ({ page }) => {
    await hydrated(page)
    const glow = page.locator('.edge-glow')
    expect(await glow.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  })

  test('nothing animates on the Fallback Page', async ({ page }) => {
    await page.goto('/exhibits')
    expect(await animatedElements(page)).toEqual([])
    expect(await currentAnimations(page)).toEqual([])
  })

  test('nothing animates on /start', async ({ page }) => {
    await page.goto('/start')
    expect(await animatedElements(page)).toEqual([])
    expect(await currentAnimations(page)).toEqual([])
  })

  // The Panel opens over the Title Screen, whose headline stays in view behind the backdrop: the
  // Panel adds nothing to that one reveal.
  test('the Exhibit Panel adds no animation', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    expect(await animatedElements(page)).toEqual(['div.headline: headline-reveal'])
    for (const name of await currentAnimations(page)) expect(name).toBe('headline-reveal')
  })

  // Read once the crossfade has ended (T0b): while the Title Screen fades out it is still shown,
  // headline included, and the sweep would count it.
  test('nothing animates in the World, the caption shown', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    const faded = await transitionEnded(titleScreenLayer(page), 'visibility')
    await page.keyboard.press('Enter')
    await faded()
    await expect(caption(page)).not.toHaveText('')
    expect(await animatedElements(page)).toEqual([])
    expect(await currentAnimations(page)).toEqual([])
  })
})
