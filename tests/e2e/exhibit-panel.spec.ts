import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { LEAVE_S, REENTRY_BUDGET_S } from '../model/helpers'
import {
  entered,
  exhibitPanel,
  expect,
  firstExhibit,
  hydrated,
  listEntry,
  modelTime,
  opened,
  recorded,
  scored,
  test,
  textOf,
  titleScreen,
  WORLD_CHUNK,
  worldContainer,
} from './fixtures'

// Seam 1, the Exhibit Panel (spec: Title Screen US-2, Reaching the Exhibit US-14, Exhibit Panel
// US-16; plan §6, T6, T7): after hydration a list entry opens the Panel over the Title Screen
// instead of navigating, before the World has loaded too; Escape or the close control closes it
// and focus returns to the entry. From the World, the Goal opens it over the paused World and
// closing returns focus to the World. Without script the entry stays a link to /exhibits#<id>
// (title-screen.spec.ts, AC-2.3).

/** The World with nothing over it: no Panel, the World container focused, the Title Screen hidden. */
async function expectBackInTheWorld(page: Page): Promise<void> {
  await expect(exhibitPanel(page)).toHaveCount(0)
  await expect(worldContainer(page)).toBeFocused()
  await expect(titleScreen(page)).toBeHidden()
}

test.describe('opening from the list', () => {
  test('picking an entry while the World chunk is held opens its Panel over the Title Screen (AC-2.1)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(WORLD_CHUNK, async (route) => {
      await held
      await route.continue()
    })
    await hydrated(page)
    await listEntry(page, exhibit.title).click()
    await expect(exhibitPanel(page).getByRole('heading', { level: 2 })).toHaveText(exhibit.title)
    await expect(exhibitPanel(page)).toContainText(textOf(exhibit.whatIdDoDifferentlyHtml))
    await expect(page).toHaveURL(/\/$/)
    // Released before the end, so no import is aborted under the fixture: the World still mounts
    // paused behind the Title Screen and the Panel.
    release()
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  })

  test('opening moves focus into the Panel, onto its close control (Focus handling)', async ({
    page,
    content,
  }) => {
    await hydrated(page)
    await listEntry(page, firstExhibit(content).title).click()
    await expect(exhibitPanel(page).getByRole('button', { name: 'Close' })).toBeFocused()
  })

  test('Enter on a focused entry opens the Panel, not the World', async ({ page, content }) => {
    const exhibit = firstExhibit(content)
    await hydrated(page)
    await listEntry(page, exhibit.title).focus()
    await page.keyboard.press('Enter')
    await expect(exhibitPanel(page)).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect(worldContainer(page)).toBeHidden()
  })

  test('from the World: Escape, then the entry opens the Panel with the full content (AC-15.1)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await entered(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await listEntry(page, exhibit.title).click()
    await expect(exhibitPanel(page).getByRole('heading', { level: 2 })).toHaveText(exhibit.title)
    await expect(exhibitPanel(page)).toContainText(textOf(exhibit.whatIdDoDifferentlyHtml))
  })
})

// One journey (Owner, #31: one driving test instead of four), since every step needs the Puck in
// the Goal and the drive is the slow part (CI renders in software). It starts with the Hub → Path → Zone → Goal run without any loading
// (AC-10.1, seam 1 half) and ends with a second Goal after the Puck has left the net (AC-14.2).
// Presence, wiring and focus only, never WebGL output.
test('from the Goal: the Panel opens over the paused World, owns the keys and closes back into it', async ({
  page,
  content,
}) => {
  test.setTimeout(240_000)
  const scriptsAfterPlayable: string[] = []
  let playable = false
  page.on('request', (request) => {
    if (playable && request.resourceType() === 'script') scriptsAfterPlayable.push(request.url())
  })
  await entered(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  playable = true
  await scored(page)
  expect(scriptsAfterPlayable, 'no script fetched on the way (AC-10.1)').toEqual([])

  // (a) The Zone's Exhibit, over the World (AC-14.1).
  await expect(exhibitPanel(page).getByRole('heading', { level: 2 })).toHaveText(
    firstExhibit(content).title,
  )
  await expect(worldContainer(page)).toBeVisible()
  await expect(titleScreen(page)).toBeHidden()

  // (b) R goes to the Panel: it stays open, focus stays inside it (AC-12.3).
  await page.keyboard.press('KeyR')
  await expect(exhibitPanel(page)).toBeVisible()
  expect(
    await page.evaluate(() => document.activeElement?.closest('dialog.exhibit-panel') != null),
  ).toBe(true)

  // (c) Escape closes the Panel only, back into the World (AC-16.5).
  await page.keyboard.press('Escape')
  await expectBackInTheWorld(page)
  // No reopen while the Puck stays in the Goal (AC-14.2): half a second of model time, no key.
  await modelTime(page, 0.5)
  expect(await exhibitPanel(page).isVisible(), 'no Panel while the Puck stays in the Goal').toBe(
    false,
  )

  // Out of the net and in again within a model-time budget (AC-14.2: the Puck is still in the
  // Goal on resume; AC-12.3: R did nothing to the paused World). A Reset by R would have put the
  // Puck at the Hub's Reset point, from where the budget cannot reach the Goal (goal.test.ts,
  // REENTRY_BUDGET_S), so the Panel would still be closed when it is read.
  await page.keyboard.down('ArrowDown')
  await modelTime(page, LEAVE_S)
  await page.keyboard.up('ArrowDown')
  await page.keyboard.down('ArrowUp')
  await modelTime(page, REENTRY_BUDGET_S)
  expect(await exhibitPanel(page).isVisible(), 'the Goal again within the budget').toBe(true)
  await page.keyboard.up('ArrowUp')

  // (d) The close control does the same as Escape (AC-16.5).
  await exhibitPanel(page).getByRole('button', { name: 'Close' }).click()
  await expectBackInTheWorld(page)
})

test.describe('closing (AC-2.2)', () => {
  test('Escape closes the Panel, shows the Title Screen and focuses the entry that opened it', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    await page.keyboard.press('Escape')
    await expect(exhibitPanel(page)).toHaveCount(0)
    await expect(titleScreen(page)).toBeVisible()
    await expect(listEntry(page, exhibit.title)).toBeFocused()
  })

  test('the close control closes the Panel, shows the Title Screen and focuses the entry that opened it', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    await exhibitPanel(page).getByRole('button', { name: 'Close' }).click()
    await expect(exhibitPanel(page)).toHaveCount(0)
    await expect(titleScreen(page)).toBeVisible()
    await expect(listEntry(page, exhibit.title)).toBeFocused()
  })
})

test.describe('reading (AC-16.1, 16.2)', () => {
  test('the Panel shows every field but the visibility, with the values loadContent read (AC-16.1, 26.1)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    const panel = exhibitPanel(page)
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText(exhibit.title)
    await expect(panel).toContainText(exhibit.hook)
    await expect(panel).toContainText(textOf(exhibit.summaryHtml))
    await expect(panel).toContainText(exhibit.role)
    for (const item of exhibit.tech) await expect(panel).toContainText(item)
    await expect(panel).toContainText(exhibit.year)
    for (const link of exhibit.links) {
      await expect(panel.getByRole('link', { name: link.label })).toHaveAttribute('href', link.url)
    }
    for (const image of exhibit.images) {
      await expect(panel.getByRole('img', { name: image.alt })).toBeAttached()
    }
    await expect(panel).toContainText(textOf(exhibit.whatIdDoDifferentlyHtml))
    // Never shown as a field: no element reads the value alone, and nothing names it. Body text that
    // happens to use the word ("personal") is not the field.
    await expect(panel.getByText(exhibit.visibility, { exact: true })).toHaveCount(0)
    await expect(panel.getByText(/visibility/i)).toHaveCount(0)
  })

  test('the Panel is named by the Exhibit’s title', async ({ page, content }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    await expect(page.getByRole('dialog', { name: exhibit.title })).toBeVisible()
  })

  test('its images are the built fallback, never the original file (AC-27.1)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    for (const image of exhibit.images) {
      const img = exhibitPanel(page).getByRole('img', { name: image.alt })
      // The build names its fallback <name>-<w>.<ext> (AC-27.1's build half); the original is never served.
      await expect(img).toHaveAttribute('src', image.fallback)
    }
  })

  test.describe('at 320 × 568', () => {
    test.use({ viewport: { width: 320, height: 568 } })

    test('long content scrolls inside the Panel (AC-16.2)', async ({ page, content }) => {
      await opened(page, firstExhibit(content).title)
      const overflows = await exhibitPanel(page).evaluate(
        (panel) => panel.scrollHeight > panel.clientHeight,
      )
      expect(overflows).toBe(true)
    })

    // The Panel sits in the top layer and scrolls itself, so its own width is checked apart from
    // the document's: content wider than the Panel would scroll sideways inside it.
    test('the Panel does not overflow sideways (AC-16.2)', async ({ page, content }) => {
      await opened(page, firstExhibit(content).title)
      const sideways = await exhibitPanel(page).evaluate(
        (panel) => panel.scrollWidth > panel.clientWidth,
      )
      expect(sideways).toBe(false)
    })

    test('the document does not overflow sideways (AC-16.2)', async ({ page, content }) => {
      await opened(page, firstExhibit(content).title)
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(sideways).toBe(false)
    })
  })

  test('the page behind does not scroll while the Panel is open (Owner, #30 Q3)', async ({
    page,
    content,
  }) => {
    await opened(page, firstExhibit(content).title)
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)
    expect(overflow).toBe('hidden')
  })

  test('the open Panel has no WCAG 2.2 AA violations', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})

// AC-16.3: Tab and Shift+Tab, two presses more than the Panel has controls, so focus has to pass
// the last and the first control at least once; after every press it is inside the Panel. The
// selector is the Panel's own list of what Tab reaches (src/site/ExhibitPanel.tsx, TABBABLE).
test.describe('focus stays inside the open Panel (AC-16.3)', () => {
  for (const key of ['Tab', 'Shift+Tab']) {
    test(`${key} never leaves the Panel`, async ({ page, content }) => {
      await opened(page, firstExhibit(content).title)
      const controls = await exhibitPanel(page)
        .locator('a[href], button:not([disabled]), video[controls]')
        .count()
      for (let press = 0; press < controls + 2; press += 1) {
        await page.keyboard.press(key)
        const inside = await page.evaluate(
          () => document.activeElement?.closest('dialog.exhibit-panel') != null,
        )
        expect(inside, `after ${key} × ${String(press + 1)}`).toBe(true)
      }
    })
  }
})
