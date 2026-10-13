// `make perf`: the CI performance budget (docs/spec/increment-1.md, Non-functional requirements).
// Serves dist/ (built by the make target), launches headless Chrome with software WebGL so the
// first frame renders and the world-playable mark exists, runs Lighthouse 13 with devtools
// throttling from perf/budget.json, and evaluates the four budget lines (scripts/perf/budget.ts):
// the title-screen-interactive mark, the world-playable mark, the download until that mark and the
// longest task between the marks (line 1's condition (b), plan §7), all gated.
//
// Three runs, judged on the median (ADR 0013, #49): the shared CI runner varies 3–4× between runs,
// so one pass cannot tell a slow chunk from a busy runner. Each of the three Lighthouse runs is
// evaluated on its own; every line, the informational TTI, LCP, CLS and TBT included, is then the
// median of the three readings (`combineRuns`), printed with all three readings, and the exit status
// follows the gated lines' medians. A run that errors (an exception, or a Lighthouse runtimeError
// such as NO_NAVSTART) is retried once on its own and counts once; a breach is never retried. A run
// that errors or lacks a value prints Lighthouse's runtimeError, runWarnings and audit errors (#41).
// Each Lighthouse result is written to .lighthouse/lhr-<run>.json, a retry's to
// .lighthouse/lhr-<run>-retry.json (a CI artifact).
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
  combineRuns,
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
const RUNS = 3
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

/** What one Lighthouse navigation produced: its report, what it said about itself, whether it errored. */
type Outcome = { report: BudgetReport; diagnostics: Diagnostics; errored: boolean }

/** One Lighthouse navigation, evaluated; an error becomes a failed report, never a throw. */
async function measure(budget: Budget, file: string): Promise<Outcome> {
  let diagnostics: Diagnostics = diagnose(undefined)
  try {
    const lhr = await runLighthouse(budget)
    await writeFile(`${OUT_DIR}/${file}`, JSON.stringify(lhr))
    diagnostics = diagnose(lhr)
    if (diagnostics.runtimeError !== null) {
      throw new Error(`Lighthouse runtime error: ${diagnostics.runtimeError}`)
    }
    return { report: evaluateBudget(lhr, budget), diagnostics, errored: false }
  } catch (error) {
    console.error(error) // the stack, for the log; the report's notes carry the message
    return {
      report: failedReport(budget, `error: ${messageOf(error)}`),
      diagnostics,
      errored: true,
    }
  }
}

function printDiagnostics(diagnostics: Diagnostics): void {
  for (const line of formatDiagnostics(diagnostics)) console.log(line)
}

/** Run `run` of RUNS: retried once on its own when it errors, then it counts once, as it came out. */
async function measureRun(run: number, budget: Budget): Promise<BudgetReport> {
  const heading = `perf budget, run ${String(run)} of ${String(RUNS)}`
  let outcome = await measure(budget, `lhr-${String(run)}.json`)
  let label = heading
  if (outcome.errored) {
    console.log(`${heading}: error, retrying once`)
    printDiagnostics(outcome.diagnostics)
    outcome = await measure(budget, `lhr-${String(run)}-retry.json`)
    label = `${heading} (retry)`
  }
  console.log(`${label}: ${outcome.errored ? 'error' : 'done'}`)
  // A failed or incomplete run says why: without this, run 2 on #41 left only "audit missing".
  if (outcome.errored || outcome.report.lines.some((l) => l.measured === null)) {
    printDiagnostics(outcome.diagnostics)
  }
  return outcome.report
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
    // No run possible (the port is taken, dist/ unreadable): still all four lines, then exit 1.
    console.error(error)
    printReport('perf budget: no run', failedReport(budget, `error: ${messageOf(error)}`))
    return 1
  }
  try {
    const reports: BudgetReport[] = []
    for (let run = 1; run <= RUNS; run++) reports.push(await measureRun(run, budget))
    const report = combineRuns(reports, budget)
    printReport(
      `perf budget, median of ${String(RUNS)} runs: ${report.pass ? 'pass' : 'FAIL'}`,
      report,
    )
    return report.pass ? 0 : 1
  } finally {
    await server.close()
  }
}

process.exitCode = await main()
