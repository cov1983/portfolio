import { expect, test as base, type Locator, type Page } from '@playwright/test'

import { loadContentFromDisk } from '../../build/content-plugin.ts'
import type { Content } from '../../src/content/types.ts'
import { TITLE_SCREEN_INTERACTIVE_MARK } from '../../src/perf/marks.ts'
import { FIXED_DT } from '../../src/world/model/world.ts'
import { MAX_STEPS_PER_FRAME } from '../../src/world/scene/stepFrame.ts'
import { vercelHeaders } from '../../vercel-headers.ts'

/** The `/(.*)` headers of vercel.json with names lower-cased, as a browser reports them. */
export function expectedResponseHeaders(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vercelHeaders()).map(([name, value]) => [name.toLowerCase(), value]),
  )
}

/** The text a Visitor reads from HTML the build rendered: tags gone, the entities markdown-it writes decoded. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ProblemKind = 'pageerror' | 'console.error' | 'securitypolicyviolation'

export type Problem = { kind: ProblemKind; detail: string }

type Fixtures = {
  /** What the page reported during the test; the `page` fixture expects it empty at the end. */
  problems: Problem[]
}

type WorkerFixtures = {
  /** The Content the site was built from (plan §6: expected values come from loadContent, never literals). */
  content: Content
}

type ReportViolation = (detail: string) => void

/** Name of the binding `page.exposeFunction` installs on `window`. */
const VIOLATION_BINDING = '__portfolioReportSecurityPolicyViolation'

// Shared e2e fixture (plan §6, Observability): every test using this `test` fails when the page
// raises an uncaught error, logs a `console.error` or reports a `securitypolicyviolation`, so the
// CI gate sees what a Visitor's console would. The violation event only exists in the page, so an
// init script forwards it through a binding before any page script runs. The binding is the only
// window global in the suite and belongs to this fixture: plan §6's rule (tests read no window
// globals and no component state) is about the site, and no test reads the binding.
export const test = base.extend<Fixtures, WorkerFixtures>({
  content: [
    async ({}, provide) => {
      const content = await loadContentFromDisk()
      // Loops over the Exhibits would pass vacuously on an empty list (AC-26.1: Exhibit-1 is in).
      expect(content.exhibits.length, 'the content has at least one Exhibit').toBeGreaterThan(0)
      await provide(content)
    },
    { scope: 'worker' },
  ],
  problems: async ({}, provide) => {
    await provide([])
  },
  page: async ({ page, problems }, provide) => {
    page.on('pageerror', (error) => {
      problems.push({ kind: 'pageerror', detail: error.message })
    })
    page.on('console', (message) => {
      if (message.type() === 'error')
        problems.push({ kind: 'console.error', detail: message.text() })
    })
    await page.exposeFunction(VIOLATION_BINDING, (detail: string) => {
      problems.push({ kind: 'securitypolicyviolation', detail })
    })
    await page.addInitScript((binding) => {
      document.addEventListener('securitypolicyviolation', (event) => {
        const report = (window as unknown as Partial<Record<string, ReportViolation>>)[binding]
        report?.(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`)
      })
    }, VIOLATION_BINDING)
    await provide(page)
    expect(problems, 'the page reported errors or CSP violations').toEqual([])
  },
})

/** Waits until the fixture recorded a problem of `kind` mentioning `detail`, then consumes that entry alone. */
export async function expectRecorded(
  problems: Problem[],
  kind: ProblemKind,
  detail: string,
): Promise<void> {
  const matches = (p: Problem): boolean => p.kind === kind && p.detail.includes(detail)
  await expect.poll(() => problems.some(matches)).toBe(true)
  problems.splice(problems.findIndex(matches), 1)
}

/**
 * Drops every recorded problem of `kind` mentioning `detail`, whether any is there or not: for a
 * browser's own line about a request the test itself broke. Chromium logs "Failed to load
 * resource" as a console error for an aborted request, before the page's own report; Firefox and
 * WebKit log nothing. The page's report is still consumed with `expectRecorded` first.
 */
export function discardRecorded(problems: Problem[], kind: ProblemKind, detail: string): void {
  const kept = problems.filter((p) => !(p.kind === kind && p.detail.includes(detail)))
  problems.splice(0, problems.length, ...kept)
}

/** Start times (ms from navigation start) of the requests matching `pattern`, from resource timing. */
export function resourceStartTimes(page: Page, pattern: RegExp): Promise<number[]> {
  return page.evaluate(
    (source) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => new RegExp(source, 'i').test(entry.name))
        .map((entry) => entry.startTime),
    pattern.source,
  )
}

/** How many times the page recorded the user-timing mark `name` (the perf gate's instruments). */
export function recorded(page: Page, name: string): Promise<number> {
  return page.evaluate((n) => performance.getEntriesByName(n, 'mark').length, name)
}

/** The World's chunks: the library chunk `world-*.js` and the World's own `World-*.js`, which imports it. */
export const WORLD_CHUNK = /\/assets\/world-.*\.js$/i

/** The ice texture's path (#55): Vite's hashed file under /assets/, the World's one fetched file besides its chunks. */
export const ICE_TEXTURE = /\/assets\/ice-[^/]*\.webp$/

/** The way-in control, whatever its label (loading or not). */
export const wayIn = (page: Page): Locator =>
  page.getByRole('button', { name: /Enter the World|Loading the World/ })

/** The World container: a section named World, focusable, inert and invisible while hidden. */
export const worldContainer = (page: Page): Locator => page.locator('section[aria-label="World"]')

export const titleScreen = (page: Page): Locator => page.locator('main.title-screen')

/** The readable failure that replaces the World (AC-22.2): a main, absent from the page otherwise. */
export const failureScreen = (page: Page): Locator => page.locator('main.world-failure')

/** The Title Screen's list entry of the Exhibit titled `title`. */
export const listEntry = (page: Page, title: string): Locator =>
  page.getByRole('navigation', { name: 'Exhibits' }).getByRole('link', { name: title })

/** The open Exhibit Panel: a modal dialog, absent from the page while closed. */
export const exhibitPanel = (page: Page): Locator => page.getByRole('dialog')

/** `/` hydrated, then the list entry of the Exhibit titled `title`: its Panel is open. */
export async function opened(page: Page, title: string): Promise<void> {
  await hydrated(page)
  await listEntry(page, title).click()
  await expect(exhibitPanel(page)).toBeVisible()
}

/** The first Exhibit of the content (the fixture guarantees one). */
export function firstExhibit(content: Content): Content['exhibits'][number] {
  const [exhibit] = content.exhibits
  if (exhibit === undefined) throw new Error('the content has no Exhibit')
  return exhibit
}

/** `/` with the Title Screen hydrated (the mark recorded): the handlers exist. */
export async function hydrated(page: Page): Promise<void> {
  await page.goto('/')
  await expect.poll(() => recorded(page, TITLE_SCREEN_INTERACTIVE_MARK)).toBe(1)
}

/** `/`, hydrated, then Enter: the World container is visible. */
export async function entered(page: Page): Promise<void> {
  await hydrated(page)
  await page.keyboard.press('Enter')
  await expect(worldContainer(page)).toBeVisible()
}

/** Any loading element: a World run that shows one is not "without any loading" (AC-10.1). */
const busy = (page: Page): Locator => page.locator('[aria-busy="true"], [role="progressbar"]')

/**
 * Holds ArrowUp until the Exhibit Panel is open: from the Reset point straight up the Hub, the
 * Path and the Zone into the Goal (AC-10.1, 14.1). Polled with non-waiting reads only (#46), so a
 * loading element seen on the way fails the run, not only at the end. CI renders in software and
 * the scene steps the model at most four times per frame, so the run takes longer than its 6 s of
 * model time; the wait is generous rather than the check weakened.
 */
export async function driveIntoGoal(page: Page): Promise<void> {
  await page.keyboard.down('ArrowUp')
  await expect
    .poll(
      async () =>
        (await busy(page).count()) > 0 ? 'a loading element' : await exhibitPanel(page).isVisible(),
      { timeout: 90_000 },
    )
    .toBe(true)
  await page.keyboard.up('ArrowUp')
}

/**
 * From the entered, playable World: the overlay's Reset control (the steering keys work after it
 * without clicking back into the World, AC-12.2), then the drive into the Goal: the Panel is open.
 * No navigation of its own, so a test can watch the requests from the moment the World is playable.
 */
export async function scored(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(worldContainer(page)).toBeFocused()
  await driveIntoGoal(page)
}

/**
 * Resolves once the page has rendered frames worth at least `seconds` of model time: each frame
 * counts what the scene can step in it at most (its delta, capped at four steps). It sets how long
 * a key is held, an input's duration, not a wait for the page to settle: no assertion depends on
 * it, the condition after it is polled. Counted in frames, not wall-clock time, so a slow software
 * renderer only makes it take longer.
 */
export function modelTime(page: Page, seconds: number): Promise<void> {
  return page.evaluate(
    ({ seconds, cap }) =>
      new Promise<void>((resolve) => {
        let total = 0
        let last = performance.now()
        const frame = (now: number): void => {
          total += Math.min((now - last) / 1000, cap)
          last = now
          if (total >= seconds) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
    { seconds, cap: MAX_STEPS_PER_FRAME * FIXED_DT },
  )
}

/** The Announcer caption: the status element inside the World overlay, never another live region. */
export const CAPTION_SELECTOR = 'section[aria-label="World"] .world-overlay [role="status"]'
export const caption = (page: Page): Locator => page.locator(CAPTION_SELECTOR)

/** What captionWithin saw: the overlay's caption text and how many caption elements it had. */
export type CaptionSeen = { text: string; count: number; withinBound: boolean }

/**
 * Watches the caption frame by frame, counting model time as `modelTime` does, until its text
 * becomes `expected` (`withinBound: true`) or `seconds` of model time have passed
 * (`withinBound: false`, which the caller's assertion turns into a failure). A text already on
 * show when it starts must first change, so the result never rests on the caption it began with.
 */
export function captionWithin(page: Page, seconds: number, expected: string): Promise<CaptionSeen> {
  return page.evaluate(
    ({ seconds, cap, selector, expected }) =>
      new Promise<CaptionSeen>((resolve) => {
        const read = (): { text: string; count: number } => {
          const elements = document.querySelectorAll(selector)
          return { text: elements[0]?.textContent ?? '', count: elements.length }
        }
        let armed = read().text !== expected
        let total = 0
        let last = performance.now()
        const frame = (now: number): void => {
          total += Math.min((now - last) / 1000, cap)
          last = now
          const seen = read()
          if (seen.text !== expected) armed = true
          else if (armed) {
            resolve({ ...seen, withinBound: true })
            return
          }
          if (total >= seconds) resolve({ ...seen, withinBound: false })
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
    { seconds, cap: MAX_STEPS_PER_FRAME * FIXED_DT, selector: CAPTION_SELECTOR, expected },
  )
}

export { expect }
