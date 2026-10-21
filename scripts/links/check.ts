// The weekly link check's evaluator (T9 #34; .github/workflows/links.yml runs scripts/check-links.ts):
// the external links of the content, each fetched through an injected fetch and judged on its final
// status, printed as lines with an exit code. Pure: no network and no disk of its own, so it is
// unit-tested with a stub fetch; the runner owns the real one. Inside the coverage ratchet (plan
// §6), like scripts/perf/budget.ts.

/** The part of Content the extractor reads (src/content/types.ts): loadContent already flags each link. */
export type LinkSource = {
  exhibits: readonly {
    id: string
    links: readonly { label: string; url: string; external: boolean }[]
  }[]
}

export type ExternalLink = { exhibit: string; label: string; url: string }

/** Every external `links[].url` in content order, duplicates kept: each line names its Exhibit. */
export function externalLinks(content: LinkSource): ExternalLink[] {
  return content.exhibits.flatMap((exhibit) =>
    exhibit.links
      .filter((link) => link.external)
      .map((link) => ({ exhibit: exhibit.id, label: link.label, url: link.url })),
  )
}

/** Per link; a host that has not answered by then is a failure naming the timeout. */
export const TIMEOUT_MS = 10_000

export const REQUEST_HEADERS = {
  'user-agent': 'portfolio-link-check (+https://github.com/cov1983/portfolio)',
  accept: 'text/html,*/*',
}

/** What the evaluator needs of fetch; the global one fits. */
export type FetchLike = (url: string, init: RequestInit) => Promise<{ status: number }>

/** One link's result: `status` null when the fetch threw, `detail` its message then. */
export type Outcome = { link: ExternalLink; ok: boolean; status: number | null; detail: string }

/** The error's message, with its cause's: Node's fetch throws "fetch failed" and keeps the reason underneath. */
function messageOf(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message
}

/**
 * GET (some hosts answer HEAD with 405), redirects followed, TIMEOUT_MS: ok on a final 2xx. The
 * body is never read. A throw (network, timeout) is a failure carrying the message.
 */
export async function checkLink(link: ExternalLink, fetchLike: FetchLike): Promise<Outcome> {
  try {
    const { status } = await fetchLike(link.url, {
      method: 'GET',
      redirect: 'follow',
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { link, ok: status >= 200 && status < 300, status, detail: '' }
  } catch (error) {
    return { link, ok: false, status: null, detail: messageOf(error) }
  }
}

/** Every link in order, one at a time: a handful of hosts, no burst. */
export async function checkLinks(
  links: readonly ExternalLink[],
  fetchLike: FetchLike,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = []
  for (const link of links) outcomes.push(await checkLink(link, fetchLike))
  return outcomes
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * One line per link (verdict, status, Exhibit, label, URL, the detail of a throw), then on any
 * failure a `::error::` annotation for the run page, then the summary line. The exit code is
 * `exitCode`'s.
 */
export function formatLines(outcomes: readonly Outcome[]): string[] {
  const exhibitWidth = Math.max(0, ...outcomes.map((o) => o.link.exhibit.length))
  const labelWidth = Math.max(0, ...outcomes.map((o) => o.link.label.length))
  const lines = outcomes.map((o) => {
    const verdict = (o.ok ? 'ok' : 'FAIL').padEnd(4)
    const status = (o.status === null ? 'n/a' : String(o.status)).padEnd(3)
    const exhibit = o.link.exhibit.padEnd(exhibitWidth)
    const label = o.link.label.padEnd(labelWidth)
    const line = `${verdict}  ${status}  ${exhibit}  ${label}  ${o.link.url}`
    return o.detail === '' ? line : `${line}  (${o.detail})`
  })
  const failed = outcomes.filter((o) => !o.ok).length
  if (failed > 0) {
    lines.push(
      `::error::link check: ${String(failed)} of ${plural(outcomes.length, 'external link')} failed`,
    )
  }
  lines.push(`links: ${String(outcomes.length)} checked, ${String(failed)} failed`)
  return lines
}

/** 1 on any failure, 0 otherwise (no external link at all is 0). */
export function exitCode(outcomes: readonly Outcome[]): 0 | 1 {
  return outcomes.some((o) => !o.ok) ? 1 : 0
}
