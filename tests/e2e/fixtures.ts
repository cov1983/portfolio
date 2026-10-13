import { expect, test as base, type Page } from '@playwright/test'

import { loadContentFromDisk } from '../../build/content-plugin.ts'
import type { Content } from '../../src/content/types.ts'
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

/** How many times the page recorded the user-timing mark `name` (the perf gate's instruments). */
export function recorded(page: Page, name: string): Promise<number> {
  return page.evaluate((n) => performance.getEntriesByName(n, 'mark').length, name)
}

export { expect }
