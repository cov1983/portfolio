// PROTOTYPE (chore/prototype-q1-q4, throwaway): `make perf` extended for the Q1–Q3 measurement run.
// One Lighthouse navigation (no retry), the three Phase 0b lines as before, plus: both user-timing
// marks, every long task between them (start, duration) from the `long-tasks` audit, TBT, TTI, the
// observed load event, and the download sum with the `/media/exhibits/` prefix exclusion. Each run
// appends one JSON line to $PERF_SUMMARY (default .lighthouse-summary.jsonl, outside .lighthouse/
// which is wiped per run). PERF_PAUSE_AFTER_LOAD_MS overrides Lighthouse's pauseAfterLoadMs (Q3).
// Exit status is always 0: this run measures, it does not gate.
import { mkdir, readFile, rm, writeFile, appendFile } from 'node:fs/promises'

import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { preview, type PreviewServer } from 'vite'

import {
  evaluateBudget,
  formatReport,
  isRecord,
  parseBudget,
  type Budget,
} from './perf/budget.ts'

const BUDGET_FILE = 'perf/budget.json'
const OUT_DIR = '.lighthouse'
const PORT = 4173
const URL_UNDER_TEST = `http://localhost:${String(PORT)}/`
const SUMMARY_FILE = process.env['PERF_SUMMARY'] ?? '.lighthouse-summary.jsonl'
const VARIANT = `${process.env['RAPIER'] ?? 'compat'}${process.env['RAPIER_SPLIT'] === '1' ? '+split' : ''}`
const PAUSE_AFTER_LOAD_MS = process.env['PERF_PAUSE_AFTER_LOAD_MS']
const EXCLUDED_PREFIX = '/media/exhibits/'
const CHROME_FLAGS = [
  '--headless=new',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--window-size=1350,940',
  ...(process.env['CHROME_NO_SANDBOX'] === '1' ? ['--no-sandbox'] : []),
]

async function runLighthouse(budget: Budget): Promise<unknown> {
  const chrome = await launch({ chromeFlags: CHROME_FLAGS })
  try {
    const result = await lighthouse(
      URL_UNDER_TEST,
      { port: chrome.port, logLevel: (process.env['PERF_LOG_LEVEL'] as 'error' | 'verbose' | undefined) ?? 'error' },
      {
        extends: 'lighthouse:default',
        settings: {
          onlyAudits: [
            'interactive',
            'user-timings',
            'network-requests',
            'long-tasks',
            'total-blocking-time',
            'metrics',
          ],
          formFactor: 'desktop',
          screenEmulation: { disabled: true },
          throttlingMethod: 'devtools',
          throttling: budget.throttling,
          ...(PAUSE_AFTER_LOAD_MS === undefined ? {} : { pauseAfterLoadMs: Number(PAUSE_AFTER_LOAD_MS) }),
        },
      },
    )
    if (result === undefined) throw new Error('Lighthouse returned no result')
    const { lhr } = result
    const runtimeError: unknown = isRecord(lhr) ? lhr['runtimeError'] : undefined
    if (isRecord(runtimeError) && typeof runtimeError['message'] === 'string') {
      throw new Error(`Lighthouse runtime error: ${runtimeError['message']}`)
    }
    return lhr
  } finally {
    chrome.kill()
  }
}

function auditOf(lhr: unknown, id: string): Record<string, unknown> | undefined {
  if (!isRecord(lhr) || !isRecord(lhr['audits'])) return undefined
  const audit = lhr['audits'][id]
  return isRecord(audit) ? audit : undefined
}
function itemsOf(lhr: unknown, id: string): Record<string, unknown>[] {
  const audit = auditOf(lhr, id)
  if (audit === undefined || !isRecord(audit['details'])) return []
  const items = audit['details']['items']
  return Array.isArray(items) ? items.filter(isRecord) : []
}
function numericOf(lhr: unknown, id: string): number | null {
  const v = auditOf(lhr, id)?.['numericValue']
  return typeof v === 'number' ? v : null
}
function markOf(lhr: unknown, name: string): number | null {
  for (const item of itemsOf(lhr, 'user-timings')) {
    if (item['name'] === name && item['timingType'] === 'Mark' && typeof item['startTime'] === 'number') {
      return item['startTime']
    }
  }
  return null
}

type LongTask = { start: number; duration: number; url: string }

function longTasksBetween(lhr: unknown, from: number | null, to: number | null): LongTask[] {
  const out: LongTask[] = []
  for (const item of itemsOf(lhr, 'long-tasks')) {
    const { startTime, duration, url } = item
    if (typeof startTime !== 'number' || typeof duration !== 'number') continue
    if (from !== null && startTime < from) continue
    if (to !== null && startTime > to) continue
    out.push({ start: startTime, duration, url: typeof url === 'string' ? url : '' })
  }
  return out
}

/** Σ transferSize of requests finished before the mark, URL path prefix /media/exhibits/ excluded. */
function downloadUntil(lhr: unknown, mark: number | null): { bytes: number; requests: { url: string; end: number; size: number }[] } {
  let bytes = 0
  const requests: { url: string; end: number; size: number }[] = []
  for (const item of itemsOf(lhr, 'network-requests')) {
    const { transferSize, networkEndTime, url } = item
    if (typeof transferSize !== 'number' || typeof networkEndTime !== 'number' || typeof url !== 'string') continue
    if (mark !== null && networkEndTime > mark) continue
    let pathname = ''
    try {
      pathname = new URL(url).pathname
    } catch {
      continue
    }
    if (pathname.startsWith(EXCLUDED_PREFIX)) continue
    bytes += transferSize
    requests.push({ url: pathname, end: Math.round(networkEndTime), size: transferSize })
  }
  return { bytes, requests }
}

function metric(lhr: unknown, key: string): number | null {
  const first = itemsOf(lhr, 'metrics')[0]
  const v = first?.[key]
  return typeof v === 'number' ? v : null
}

async function main(): Promise<number> {
  const budget = parseBudget(JSON.parse(await readFile(BUDGET_FILE, 'utf8')))
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
  const server: PreviewServer = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' })
  try {
    const lhr = await runLighthouse(budget)
    await writeFile(`${OUT_DIR}/lhr-1.json`, JSON.stringify(lhr))
    const report = evaluateBudget(lhr, budget)
    console.log(`perf budget (Phase 0b lines, informational): ${report.pass ? 'pass' : 'FAIL'}`)
    for (const line of formatReport(report)) console.log(line)

    const titleMark = markOf(lhr, 'title-screen-interactive')
    const worldMark = markOf(lhr, 'world-playable')
    const tasks = longTasksBetween(lhr, titleMark, worldMark)
    const longest = tasks.reduce((m, t) => Math.max(m, t.duration), 0)
    const download = downloadUntil(lhr, worldMark)
    const summary = {
      variant: VARIANT,
      pauseAfterLoadMs: PAUSE_AFTER_LOAD_MS ?? 'default',
      titleScreenInteractiveMs: titleMark,
      worldPlayableMs: worldMark,
      longTasksBetween: tasks,
      longestTaskBetweenMs: longest,
      tbtMs: numericOf(lhr, 'total-blocking-time'),
      ttiMs: numericOf(lhr, 'interactive'),
      observedLoadMs: metric(lhr, 'observedLoad'),
      observedDomContentLoadedMs: metric(lhr, 'observedDomContentLoaded'),
      observedTraceEndMs: metric(lhr, 'observedTraceEnd'),
      downloadUntilPlayableBytes: download.bytes,
      requestsUntilPlayable: download.requests,
      userTimings: itemsOf(lhr, 'user-timings'),
    }
    console.log(`variant ${VARIANT}`)
    console.log(`  title-screen-interactive  ${String(titleMark)} ms`)
    console.log(`  world-playable            ${String(worldMark)} ms`)
    console.log(`  long tasks between marks  ${tasks.length === 0 ? 'none' : tasks.map((t) => `${String(Math.round(t.start))}ms+${String(Math.round(t.duration))}ms`).join(', ')}`)
    console.log(`  longest task between      ${String(Math.round(longest))} ms`)
    console.log(`  TBT                       ${String(summary.tbtMs)} ms`)
    console.log(`  TTI                       ${String(summary.ttiMs)} ms`)
    console.log(`  observed load / trace end ${String(summary.observedLoadMs)} / ${String(summary.observedTraceEndMs)} ms`)
    console.log(`  download until playable   ${download.bytes.toLocaleString('en-US')} B over ${String(download.requests.length)} requests`)
    await appendFile(SUMMARY_FILE, `${JSON.stringify(summary)}\n`)
    return 0
  } catch (error) {
    console.error(error)
    return 1
  } finally {
    await server.close()
  }
}

process.exitCode = await main()
