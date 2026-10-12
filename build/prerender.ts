// The pure half of pre-rendering (ADR 0010): the route table and the document assembly that
// build/build.ts (I/O) applies to the client build's index.html or to the script-free shell.
// Text operations, no DOM. A third route is a third entry in ROUTES here and a third case in
// src/entry-prerender.tsx, which decides what that route renders.

/** One pre-rendered document: its path on the site, its file under dist/, whether it keeps the script. */
export type Route = { path: string; file: string; script: boolean }

export const ROUTES: readonly Route[] = [
  { path: '/', file: 'index.html', script: true },
  // The Fallback Page carries no script at all (plan §2).
  { path: '/exhibits', file: 'exhibits/index.html', script: false },
]

/** The placeholders of index.html, Vite's SSR convention. */
export const HEAD_PLACEHOLDER = '<!--app-head-->'
export const HTML_PLACEHOLDER = '<!--app-html-->'

export type Fragments = { head: string; body: string }

/** The shell with both placeholders replaced; a missing placeholder is an error, never a blank page. */
export function fillShell(shell: string, { head, body }: Fragments): string {
  for (const placeholder of [HEAD_PLACEHOLDER, HTML_PLACEHOLDER]) {
    if (!shell.includes(placeholder)) {
      throw new Error(`index.html has no ${placeholder} placeholder`)
    }
  }
  return shell.replace(HEAD_PLACEHOLDER, () => head).replace(HTML_PLACEHOLDER, () => body)
}

/** What index.html's head opens with; the Fallback shell repeats the same values. */
const CHARSET = '<meta charset="UTF-8" />'
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'

/**
 * The shell of a document that ships no script (the Fallback Page, plan §2): a complete minimal
 * document with the client build's stylesheets and the two placeholders, written from nothing
 * rather than filtered out of index.html, so no script is ever in it to remove.
 */
export function fallbackShell(stylesheets: readonly string[]): string {
  const links = stylesheets.map((href) => `    <link rel="stylesheet" href="${href}">\n`).join('')
  return (
    '<!doctype html>\n' +
    '<html lang="en">\n' +
    '  <head>\n' +
    `    ${CHARSET}\n` +
    `    ${VIEWPORT}\n` +
    links +
    `    ${HEAD_PLACEHOLDER}\n` +
    '  </head>\n' +
    '  <body>\n' +
    `    <div id="root">${HTML_PLACEHOLDER}</div>\n` +
    '  </body>\n' +
    '</html>\n'
  )
}

/**
 * The preview mirror of vercel.json's `cleanUrls` (plan §2): a path without an extension whose
 * directory holds an index.html is served from it. Anything else is returned unchanged.
 */
export function cleanUrl(pathname: string, exists: (relative: string) => boolean): string {
  if (pathname === '/' || pathname.endsWith('/') || /\.[a-z0-9]+$/i.test(pathname)) return pathname
  const index = `${pathname.slice(1)}/index.html`
  return exists(index) ? `/${index}` : pathname
}

/**
 * The site's origin for absolute Open Graph URLs (Owner on #27 Q3): SITE_ORIGIN when set; on
 * Vercel the production domain for a production build, else the deployment's own host (previews
 * point at themselves); '' elsewhere, so the URLs stay relative (local builds, CI).
 */
export function siteOrigin(env: Record<string, string | undefined>): string {
  const explicit = env['SITE_ORIGIN']
  if (explicit !== undefined && explicit !== '') return explicit.replace(/\/+$/, '')
  const production = env['VERCEL_PROJECT_PRODUCTION_URL']
  if (env['VERCEL_ENV'] === 'production' && production !== undefined && production !== '') {
    return `https://${production}`
  }
  const deployment = env['VERCEL_URL']
  if (deployment !== undefined && deployment !== '') return `https://${deployment}`
  return ''
}
