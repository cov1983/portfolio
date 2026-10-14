import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  entered,
  exhibitPanel,
  expect,
  firstExhibit,
  hydrated,
  listEntry,
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
    await hydrated(page)
    await listEntry(page, exhibit.title).click()
    await expect(exhibitPanel(page)).toBeVisible()
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
    await hydrated(page)
    await listEntry(page, exhibit.title).click()
    await exhibitPanel(page).getByRole('button', { name: 'Close' }).click()
    await expect(exhibitPanel(page)).toHaveCount(0)
    await expect(titleScreen(page)).toBeVisible()
    await expect(listEntry(page, exhibit.title)).toBeFocused()
  })
})
