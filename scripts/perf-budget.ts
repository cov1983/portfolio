// `make perf`: the CI performance budget (docs/spec/increment-1.md, Non-functional requirements).
// Serves dist/ (built by the make target), launches headless Chrome with software WebGL so the
// first frame renders and the world-playable mark exists, runs Lighthouse 13 with devtools
// throttling from perf/budget.json, and evaluates the four budget lines (scripts/perf/budget.ts):
// the title-screen-interactive mark, the world-playable mark, the download until that mark and the
// longest task between the marks (line 1's condition (b), plan §7), all gated.
//
// A warm-up navigation, then three runs judged on the median (ADR 0013, #49; ADR 0014, #58): the
// shared CI runner varies 3–4× between runs and its first navigation is the slowest in every job,
// so the warm-up is run exactly like a measured one, printed and discarded. Each measured run is
// evaluated on its own; every line, the informational TTI, LCP, CLS and TBT included, is then the
// median of the three readings (`combineRuns`), printed with all three readings, and the exit status
// follows the gated lines' medians. A run that is not a measurement (`invalidReason`: no gated
// reading, as after an exception, a Lighthouse runtimeError or NO_NAVSTART on every trace audit;
// TTI far before world-playable; no long task between the marks) is retried once on its own and
// counts once; invalid twice, it counts as the worst reading (`settleRun`); a breach is never
// retried. A run that fails, errors or lacks a value prints Lighthouse's runtimeError, runWarnings
// and audit errors (#41), and a discarded attempt prints its readings, so nothing measured leaves
// the log. Each Lighthouse result is written to .lighthouse/: lhr-warmup.json, lhr-<run>.json, a
// retry's lhr-<run>-retry.json (a CI artifact).
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
  formatRunSummary,
  invalidReason,
  parseBudget,
  settleRun,
  type Attempt,
  type Budget,
  type BudgetReport,
  type Diagnostics,
  type JudgedAttempt,
  type RunOutcome,
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

/** One Lighthouse navigation, evaluated; an error becomes a failed report, never a throw. */
async function measure(budget: Budget, file: string): Promise<Attempt> {
  let diagnostics: Diagnostics = diagnose(undefined)
  try {
    const lhr = await runLighthouse(budget)
    await writeFile(`${OUT_DIR}/${file}`, JSON.stringify(lhr))
    diagnostics = diagnose(lhr)
    if (diagnostics.runtimeError !== null) {
      throw new Error(`Lighthouse runtime error: ${diagnostics.runtimeError}`)
    }
    return { report: evaluateBudget(lhr, budget), diagnostics }
  } catch (error) {
    console.error(error) // the stack, for the log; the report's notes carry the message
    return { report: failedReport(budget, `error: ${messageOf(error)}`), diagnostics }
  }
}

function printDiagnostics(diagnostics: Diagnostics): void {
  for (const line of formatDiagnostics(diagnostics)) console.log(line)
}

function printLines(report: BudgetReport): void {
  for (const line of formatReport(report)) console.log(line)
}

/** A failed or incomplete report says why: without this, run 2 on #41 left only "audit missing". */
function printDiagnosticsIfNeeded({ report, diagnostics }: Attempt): void {
  if (!report.pass || report.lines.some((l) => l.measured === null)) printDiagnostics(diagnostics)
}

/** The warm-up navigation (#58): run and printed like a measured one, never judged, never counted. */
async function warmUp(budget: Budget): Promise<void> {
  const attempt = await measure(budget, 'lhr-warmup.json')
  console.log('perf budget, warm-up (discarded): readings for information')
  printLines(attempt.report)
  printDiagnosticsIfNeeded(attempt)
}

/** Run `run` of RUNS: an attempt that is not a measurement is retried once; `settleRun` says what counts (#58). */
async function measureRun(run: number, budget: Budget): Promise<RunOutcome> {
  const heading = `perf budget, run ${String(run)} of ${String(RUNS)}`
  const judged: JudgedAttempt[] = []
  let attempt = await measure(budget, `lhr-${String(run)}.json`)
  let invalid = invalidReason(attempt)
  judged.push({ report: attempt.report, invalid })
  let label = heading
  if (invalid !== null) {
    console.log(`${heading}: invalid (${invalid}), retrying once; its readings, discarded:`)
    printLines(attempt.report)
    printDiagnosticsIfNeeded(attempt)
    attempt = await measure(budget, `lhr-${String(run)}-retry.json`)
    invalid = invalidReason(attempt)
    judged.push({ report: attempt.report, invalid })
    label = `${heading} (retry)`
  }
  if (invalid === null) {
    console.log(`${label}: done`)
  } else {
    console.log(
      `${label}: invalid again (${invalid}), counted as the worst reading; its readings, discarded:`,
    )
    printLines(attempt.report)
  }
  printDiagnosticsIfNeeded(attempt)
  return settleRun(judged, budget)
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
    console.log('perf budget: no run')
    printLines(failedReport(budget, `error: ${messageOf(error)}`))
    return 1
  }
  try {
    await warmUp(budget)
    const outcomes: RunOutcome[] = []
    for (let run = 1; run <= RUNS; run++) outcomes.push(await measureRun(run, budget))
    const report = combineRuns(
      outcomes.map((o) => o.report),
      budget,
    )
    console.log(`perf budget, median of ${String(RUNS)} runs: ${report.pass ? 'pass' : 'FAIL'}`)
    console.log(`  ${formatRunSummary(outcomes)}`)
    printLines(report)
    return report.pass ? 0 : 1
  } finally {
    await server.close()
  }
}

process.exitCode = await main()
