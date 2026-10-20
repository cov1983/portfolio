import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  discardRecorded,
  expect,
  expectRecorded,
  failureScreen,
  hydrated,
  recorded,
  test,
  titleScreen,
  wayIn,
  WORLD_CHUNK,
  worldContainer,
  type Problem,
} from './fixtures'

// Seam 1, AC-22.2 (spec US-22; plan §5 and §6 row 22.2, corrected by #33): when the World fails
// after the Visitor entered it, or Enter meets a World that failed before, a readable message with
// the Fallback Page link replaces the World and the Title Screen remains reachable. Each path
// simulates one failure the way a Visitor's browser would meet it, and consumes the one structured
// console line App logs (`World failed`, plan §7) through the shared fixture, which otherwise
// fails the test on it: an unexpected second line still fails. Nothing here drives the Puck, and
// every appearance is event-driven (a rejected import, a DOM event, a render throw), so the
// project's default expect timeouts are the bound: no timeout is raised.

/** The Fallback Page link, by its text (the Title Screen's, AC-1.1). */
const FALLBACK_LINK = { name: /plain page/ }

/**
 * App's one structured line for the failure, consumed; then the browser's own line about the
 * request the test aborted (Chromium only, see discardRecorded), which is no second report.
 */
async function failureReported(problems: Problem[]): Promise<void> {
  await expectRecorded(problems, 'console.error', 'World failed')
  discardRecorded(problems, 'console.error', 'Failed to load resource')
}

/** `/` hydrated, Enter: the readable failure is on show. */
async function enteredIntoFailure(page: Page): Promise<void> {
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(failureScreen(page)).toBeVisible()
}

// Path A: the world chunk's request aborted, so the dynamic import rejects (T5b's loader reports
// `bundle`). The preload meets it behind the Title Screen; Enter then shows the message.
test.describe('the world chunk aborted', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(WORLD_CHUNK, (route) => route.abort())
  })

  test('after Enter a readable message with the Fallback link replaces the World (AC-22.2)', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await expect(failureScreen(page)).toContainText('did not load')
    await expect(failureScreen(page).getByRole('link', FALLBACK_LINK)).toHaveAttribute(
      'href',
      '/exhibits',
    )
    await expect(titleScreen(page)).toBeHidden()
    await expect(worldContainer(page)).toHaveCount(0)
    await failureReported(problems)
  })

  test('the message takes focus, so it is read and its link is in reach', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await expect(failureScreen(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(failureScreen(page).getByRole('link', FALLBACK_LINK)).toBeFocused()
    await failureReported(problems)
  })

  test('Escape shows the Title Screen again, the message gone (AC-22.2)', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toHaveCount(0)
    await expect(wayIn(page)).toBeEnabled()
    await failureReported(problems)
  })

  test('the Title Screen control does what Escape does, for a Visitor without an Escape key', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await failureScreen(page).getByRole('button', { name: 'Title Screen' }).click()
    await expect(titleScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toHaveCount(0)
    await failureReported(problems)
  })

  test('Enter from the Title Screen shows the message again, without a reload', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(failureScreen(page)).toBeVisible()
    await failureReported(problems)
  })

  test('the Fallback link navigates', async ({ page, problems }) => {
    await enteredIntoFailure(page)
    await failureReported(problems)
    await failureScreen(page).getByRole('link', FALLBACK_LINK).click()
    await expect(page).toHaveURL(/\/exhibits$/)
  })

  test('has no WCAG 2.2 AA violations', async ({ page, problems }) => {
    await enteredIntoFailure(page)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await failureReported(problems)
  })
})

// Path B: a throw during the World's render (T8a's hand-off on #33). The entry chunk is rewritten
// in flight so the content's Hub caption sits under another key: nothing is looked up behind the
// Title Screen (the World preloads and records world-playable as usual), and on entry the
// welcome's lookup throws in the World's render. The failure boundary turns it into the message,
// and the hydrated root with the Title Screen survives. The rewrite is asserted, so a change of
// the chunk's shape fails here, not silently.
test.describe('a throw during the World’s render', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/assets\/index-[^/]*\.js$/, async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace('captions:{hub:', 'captions:{hub_:')
      expect(body).toContain('captions:{hub_:')
      await route.fulfill({ response, body })
    })
  })

  test('the boundary replaces the World with the readable message and keeps the Title Screen (AC-22.2)', async ({
    page,
    problems,
    content,
  }) => {
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    await page.keyboard.press('Enter')
    await expect(failureScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toContainText('error while drawing')
    await expect(worldContainer(page)).toHaveCount(0)
    await expect(titleScreen(page)).toHaveCount(1)
    await expect(titleScreen(page)).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await expect(titleScreen(page).getByRole('heading', { level: 1 })).toHaveText(
      content.owner.name,
    )
    await expectRecorded(problems, 'console.error', 'World failed')
  })
})
