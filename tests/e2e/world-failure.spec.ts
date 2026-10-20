import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import {
  expect,
  expectRecorded,
  failureScreen,
  hydrated,
  ICE_TEXTURE,
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

/** What a test aborted: the route counts its requests, so the browser's lines about them can be counted too. */
type Aborted = { requests: number }

/** Aborts every request matching `pattern` and counts them (a chunk may be fetched more than once). */
async function abortRequests(page: Page, pattern: RegExp): Promise<Aborted> {
  const aborted: Aborted = { requests: 0 }
  await page.route(pattern, (route) => {
    aborted.requests += 1
    return route.abort()
  })
  return aborted
}

/**
 * App's one structured line for the failure, consumed; then, in Chromium alone, its own
 * "Failed to load resource" line for each request the test aborted (Firefox and WebKit log
 * nothing for it), consumed one per request, so a browser line nobody expected still fails.
 */
async function failureReported(
  problems: Problem[],
  browserName: string,
  aborted: Aborted,
): Promise<void> {
  await expectRecorded(problems, 'console.error', 'World failed')
  if (browserName !== 'chromium') return
  for (let i = 0; i < aborted.requests; i++)
    await expectRecorded(problems, 'console.error', 'Failed to load resource')
}

/** The message with the Fallback link is on show in place of the World, the Title Screen hidden but mounted. */
async function expectWorldReplaced(page: Page): Promise<void> {
  await expect(failureScreen(page).getByRole('link', FALLBACK_LINK)).toHaveAttribute(
    'href',
    '/exhibits',
  )
  await expect(worldContainer(page)).toHaveCount(0)
  await expect(titleScreen(page)).toHaveCount(1)
  await expect(titleScreen(page)).toBeHidden()
}

/** `/` hydrated, Enter: the readable failure is on show. */
async function enteredIntoFailure(page: Page): Promise<void> {
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(failureScreen(page)).toBeVisible()
}

// Path A: the world chunk's requests aborted (the World's own chunk and the library chunk it
// imports, each possibly preloaded and fetched), so the dynamic import rejects (T5b's loader
// reports `bundle`). The preload meets it behind the Title Screen; Enter then shows the message.
test.describe('the world chunk aborted', () => {
  test('after Enter a readable message with the Fallback link replaces the World (AC-22.2)', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await expect(failureScreen(page).getByRole('heading', { level: 1 })).toHaveText(
      'The World could not start',
    )
    await expect(failureScreen(page)).toContainText('did not load')
    await expectWorldReplaced(page)
    await failureReported(problems, browserName, aborted)
  })

  test('the message takes focus, so it is read and its link is in reach', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await expect(failureScreen(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(failureScreen(page).getByRole('link', FALLBACK_LINK)).toBeFocused()
    await failureReported(problems, browserName, aborted)
  })

  test('Escape shows the Title Screen again, the message gone (AC-22.2)', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toHaveCount(0)
    await expect(wayIn(page)).toBeEnabled()
    await failureReported(problems, browserName, aborted)
  })

  test('the Title Screen control does what Escape does, for a Visitor without an Escape key', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await failureScreen(page).getByRole('button', { name: 'Title Screen' }).click()
    await expect(titleScreen(page)).toBeVisible()
    await expect(failureScreen(page)).toHaveCount(0)
    await failureReported(problems, browserName, aborted)
  })

  test('Enter from the Title Screen shows the message again, without a reload', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(failureScreen(page)).toBeVisible()
    await failureReported(problems, browserName, aborted)
  })

  test('the Fallback link navigates', async ({ page, problems, browserName }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    await failureReported(problems, browserName, aborted)
    await failureScreen(page).getByRole('link', FALLBACK_LINK).click()
    await expect(page).toHaveURL(/\/exhibits$/)
  })

  test('has no WCAG 2.2 AA violations', async ({ page, problems, browserName }) => {
    const aborted = await abortRequests(page, WORLD_CHUNK)
    await enteredIntoFailure(page)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await failureReported(problems, browserName, aborted)
  })
})

// Path B: a throw during the World's render (T8a's hand-off on #33). The entry chunk is rewritten
// in flight so the content's Hub caption sits under another key: nothing is looked up behind the
// Title Screen (the World preloads and records world-playable as usual), and on entry the
// welcome's lookup throws in the World's render. The failure boundary turns it into the message,
// and the hydrated root with the Title Screen survives. The rewrite is asserted, so a change of
// the chunk's shape fails here, not silently. The heading reads "stopped": the Visitor entered
// and the World was on screen when the throw came, even though no frame was steered (Owner, the
// round-2 triage of #64); a phase that depended on a frame shown is not worth new state.
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
    await expect(failureScreen(page).getByRole('heading', { level: 1 })).toHaveText(
      'The World stopped',
    )
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

// Path C: the ice texture's request aborted (#55's hand-off on #33): the scene reports it as a
// `bundle` failure like the chunk, met by the preload behind the Title Screen.
test.describe('the ice texture aborted', () => {
  test('after Enter a readable message with the Fallback link replaces the World (AC-22.2)', async ({
    page,
    problems,
    browserName,
  }) => {
    const aborted = await abortRequests(page, ICE_TEXTURE)
    await enteredIntoFailure(page)
    await expect(failureScreen(page)).toContainText('did not load')
    await expectWorldReplaced(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await failureReported(problems, browserName, aborted)
  })
})

// Path D: the WebGL context lost while the World runs, through the WEBGL_lose_context extension
// on the page's canvas (a DOM read, no window global): the scene reports `webgl`, no recovery
// (Owner, #33 Q4). The heading reads "stopped": the Visitor was steering.
test('a lost WebGL context replaces the World with the readable message (AC-22.2)', async ({
  page,
  problems,
}) => {
  await hydrated(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeVisible()
  await page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  })
  await expect(failureScreen(page)).toBeVisible()
  // The World was playable when its context went: it stopped, it did not fail to start (#64).
  await expect(failureScreen(page).getByRole('heading', { level: 1 })).toHaveText(
    'The World stopped',
  )
  await expect(failureScreen(page)).toContainText('WebGL')
  await expectWorldReplaced(page)
  await page.keyboard.press('Escape')
  await expect(titleScreen(page)).toBeVisible()
  await expectRecorded(problems, 'console.error', 'World failed')
})

// Path E: physics. Rapier's compat package decodes its inline wasm and instantiates it with
// WebAssembly.instantiate; stubbed to reject before any page script runs, its init rejects and
// the scene reports `physics`, met by the preload behind the Title Screen.
test.describe('physics failing to initialise', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      WebAssembly.instantiate = (): Promise<never> =>
        Promise.reject(new Error('wasm refused by the test'))
    })
  })

  test('after Enter a readable message with the Fallback link replaces the World (AC-22.2)', async ({
    page,
    problems,
  }) => {
    await enteredIntoFailure(page)
    await expect(failureScreen(page)).toContainText('physics engine')
    await expectWorldReplaced(page)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await expectRecorded(problems, 'console.error', 'World failed')
  })
})
