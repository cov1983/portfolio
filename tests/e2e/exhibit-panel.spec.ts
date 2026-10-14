import AxeBuilder from '@axe-core/playwright'
import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  entered,
  exhibitPanel,
  expect,
  firstExhibit,
  hydrated,
  listEntry,
  opened,
  recorded,
  test,
  textOf,
  titleScreen,
  WORLD_CHUNK,
  worldContainer,
} from './fixtures'

// Seam 1, the Exhibit Panel over the Title Screen (spec: Title Screen US-2, Exhibit Panel US-16;
// plan §6, T6): after hydration a list entry opens the Panel instead of navigating, before the
// World has loaded too; Escape or the close control closes it and focus returns to the entry.
// Without script the entry stays a link to /exhibits#<id> (title-screen.spec.ts, AC-2.3).

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
    await expect(panel).not.toContainText(exhibit.visibility)
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
