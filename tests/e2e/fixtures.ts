import { expect, test as base } from '@playwright/test'

import vercel from '../../vercel.json' with { type: 'json' }

// ADR 0012: the response headers live in vercel.json; vite.config.ts serves the same array from
// `vite preview`, so what the e2e run sees is what the Vercel deployment sends.
const ALL_PATHS = '/(.*)'

/** The `/(.*)` headers of vercel.json, names lower-cased as a browser reports them. */
export function vercelHeaders(): Record<string, string> {
  const entry = vercel.headers.find((h) => h.source === ALL_PATHS)
  if (entry === undefined) {
    throw new Error(`vercel.json has no headers entry for ${ALL_PATHS}`)
  }
  return Object.fromEntries(entry.headers.map((h) => [h.key.toLowerCase(), h.value]))
}

type Fixtures = {
  /** What the page reported during the test; the `page` fixture expects it empty at the end. */
  problems: string[]
}

type ReportViolation = (detail: string) => void

/** Name of the binding `page.exposeFunction` installs on `window`; owned by this fixture, never read by a test. */
const VIOLATION_BINDING = '__portfolioReportSecurityPolicyViolation'

// Shared e2e fixture (plan §6, Observability): every test using this `test` fails when the page
// raises an uncaught error, logs a `console.error` or reports a `securitypolicyviolation`, so the
// CI gate sees what a Visitor's console would. The violation event only exists in the page, so an
// init script forwards it through a binding before any page script runs.
export const test = base.extend<Fixtures>({
  problems: async ({}, provide) => {
    await provide([])
  },
  page: async ({ page, problems }, provide) => {
    page.on('pageerror', (error) => {
      problems.push(`pageerror: ${error.message}`)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text()}`)
    })
    await page.exposeFunction(VIOLATION_BINDING, (detail: string) => {
      problems.push(`securitypolicyviolation: ${detail}`)
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

export { expect }
