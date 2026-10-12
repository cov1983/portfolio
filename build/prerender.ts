// The pure half of pre-rendering (ADR 0010): the route table and the document assembly that
// build/build.ts (I/O) applies to the client build's index.html. Text operations on Vite's own
// markup, no DOM. A third route is a third entry in ROUTES, nothing else.

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

const SCRIPT_ELEMENT = /\s*<script\b[^>]*>[\s\S]*?<\/script>/gi
const MODULEPRELOAD_LINK = /\s*<link\b[^>]*\brel\s*=\s*["']modulepreload["'][^>]*>/gi

/** The shell without its scripts and module preloads; stylesheets stay. */
export function withoutScripts(html: string): string {
  return html.replace(SCRIPT_ELEMENT, '').replace(MODULEPRELOAD_LINK, '')
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
