// `make perf`: the CI performance budget (docs/spec/increment-1.md, Non-functional requirements).
// Serves dist/ (built by the make target), launches headless Chrome with software WebGL so the
// first frame renders and the world-playable mark exists, runs Lighthouse 13 with devtools
// throttling from perf/budget.json, and evaluates the three budget lines (scripts/perf/budget.ts):
// the title-screen-interactive mark, the world-playable mark and the download until that mark, all
// gated (plan §7; line 1 reads the mark since T5a). All three numbers are always printed, followed by
// TTI, LCP, CLS and TBT as informational lines. A run that breaches or errors is retried once; the
// exit status follows the last run (Phase 0b plan, Owner decision 5). A run that fails or lacks a value also prints Lighthouse's
// runtimeError, runWarnings and audit errors. Each run's Lighthouse result is written to
// .lighthouse/lhr-<run>.json (a CI artifact).
//
// Chrome: chrome-launcher finds an installed Chrome or Chromium; where there is none (the
// devcontainer), point CHROME_PATH at one, e.g. the Chromium that `make browsers` installs.
// Inside a container Chrome's sandbox cannot start; CHROME_NO_SANDBOX=1 adds --no-sandbox there.
// CI runners have a working sandbox and never set it.
// Runs under plain Node 24 (type stripping), so imports carry the .ts extension.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { preview, type PreviewServer } from 'vite'

import {
  AUDIT_IDS,
  diagnose,
  evaluateBudget,
  failedReport,
  formatDiagnostics,
  formatReport,
  parseBudget,
  type Budget,
  type BudgetReport,
  type Diagnostics,
} from './perf/budget.ts'

const BUDGET_FILE = 'perf/budget.json'
const OUT_DIR = '.lighthouse'
const PORT = 4173
// A plain navigation to `/`: the World preloads behind the Title Screen and records world-playable
// there (plan §2, §7 line 2), so every line is measured as a Visitor would see it.
const URL_UNDER_TEST = `http://localhost:${String(PORT)}/`
const RUNS = 2
const CHROME_FLAGS = [
  '--headless=new',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--window-size=1350,940',
  ...(process.env['CHROME_NO_SANDBOX'] === '1' ? ['--no-sandbox'] : []),
]

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** One Lighthouse navigation in a fresh Chrome. Returns the Lighthouse result object (lhr). */
async function runLighthouse(budget: Budget): Promise<unknown> {
  const chrome = await launch({ chromeFlags: CHROME_FLAGS })
  try {
    const result = await lighthouse(
      URL_UNDER_TEST,
      { port: chrome.port, logLevel: 'error' },
      {
        extends: 'lighthouse:default',
        settings: {
          onlyAudits: [...AUDIT_IDS],
          formFactor: 'desktop',
          screenEmulation: { disabled: true },
          throttlingMethod: 'devtools',
          throttling: budget.throttling,
        },
      },
    )
    if (result === undefined) throw new Error('Lighthouse returned no result')
    return result.lhr
  } finally {
    chrome.kill()
  }
}

async function attempt(run: number, budget: Budget): Promise<BudgetReport> {
  let report: BudgetReport
  let diagnostics: Diagnostics = diagnose(undefined)
  try {
    const lhr = await runLighthouse(budget)
    await writeFile(`${OUT_DIR}/lhr-${String(run)}.json`, JSON.stringify(lhr))
    diagnostics = diagnose(lhr)
    if (diagnostics.runtimeError !== null) {
      throw new Error(`Lighthouse runtime error: ${diagnostics.runtimeError}`)
    }
    report = evaluateBudget(lhr, budget)
  } catch (error) {
    console.error(error) // the stack, for the log; the lines below carry the message
    report = failedReport(budget, `error: ${messageOf(error)}`)
  }
  printReport(
    `perf budget, run ${String(run)} of ${String(RUNS)}: ${report.pass ? 'pass' : 'FAIL'}`,
    report,
  )
  // A failed or incomplete run says why: without this, run 2 on #41 left only "audit missing".
  if (!report.pass || report.lines.some((l) => l.measured === null)) {
    for (const line of formatDiagnostics(diagnostics)) console.log(line)
  }
  return report
}

function printReport(heading: string, report: BudgetReport): void {
  console.log(heading)
  for (const line of formatReport(report)) console.log(line)
}

async function main(): Promise<number> {
  const budget = parseBudget(JSON.parse(await readFile(BUDGET_FILE, 'utf8')))
  await rm(OUT_DIR, { recursive: true, force: true }) // no stale result from an earlier run
  await mkdir(OUT_DIR, { recursive: true })
  let server: PreviewServer
  try {
    server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' })
  } catch (error) {
    // No run possible (the port is taken, dist/ unreadable): still all three lines, then exit 1.
    console.error(error)
    printReport('perf budget: no run', failedReport(budget, `error: ${messageOf(error)}`))
    return 1
  }
  try {
    let report = await attempt(1, budget)
    if (!report.pass) {
      console.log('retrying once')
      report = await attempt(2, budget)
    }
    return report.pass ? 0 : 1
  } finally {
    await server.close()
  }
}

process.exitCode = await main()
