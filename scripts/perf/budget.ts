// Pure evaluation of the CI performance budget (docs/spec/increment-1.md, Non-functional
// requirements) against a Lighthouse result. No I/O: the runner (scripts/perf-budget.ts) reads the
// budget file and runs Lighthouse, then prints what comes back from here. Every budget line is
// always reported, also when its input is missing or the run failed, so a breach never hides
// behind an error (Phase 0b plan, Owner decision 5). All four lines are gated (their breach fails
// the run): the three limits of the spec and, since T5b, line 1's condition (b) of plan §7, no
// long task ≥ the limit between the two marks (ADR 0013: 150 ms on the CI runner). TTI, LCP, CLS
// and TBT follow as informational lines that never decide (plan §7). Since #49 the runner makes
// three Lighthouse runs and `combineRuns` judges each line on the median of their readings
// (ADR 0013); every reading is kept on the line and printed next to the median.
import { TITLE_SCREEN_INTERACTIVE_MARK, WORLD_PLAYABLE_MARK } from '../../src/perf/marks.ts'

export type Throttling = {
  rttMs: number
  throughputKbps: number
  requestLatencyMs: number
  downloadThroughputKbps: number
  uploadThroughputKbps: number
  cpuSlowdownMultiplier: number
}

export type Limits = {
  titleScreenInteractiveMs: number
  worldPlayableMs: number
  downloadUntilPlayableBytes: number
  /** The longest task allowed to start between the marks must stay under this (ADR 0013). */
  longTaskBetweenMarksMs: number
}

export type Budget = { throttling: Throttling; limits: Limits }

export type BudgetLineId =
  | 'title-screen-interactive'
  | 'world-playable'
  | 'download-until-playable'
  | 'long-task-between-marks'

export type Unit = 'ms' | 'B'

export type BudgetLine = {
  id: BudgetLineId
  label: string
  /** null when the run produced no value for this line; the note says why. The median over runs. */
  measured: number | null
  /** Every run's reading, in run order; `measured` is their median (`medianOf`). */
  readings: (number | null)[]
  limit: number
  unit: Unit
  /** measured ≤ limit, or measured < limit on a strict line. */
  pass: boolean
  /** A gated line's breach fails the run; every line is gated since T5a (plan §7). */
  gated: boolean
  /** The limit is a bound the value must stay under ("no long task ≥ the limit"), printed as `< limit`. */
  strict: boolean
  note?: string
}

export type InfoLineId = 'tti' | 'lcp' | 'cls' | 'tbt'

/** `score` is a unitless Lighthouse value (CLS). */
export type InfoUnit = 'ms' | 'score'

/** A reading printed next to the budget, with no limit and no verdict: a regression is read across runs. */
export type InfoLine = {
  id: InfoLineId
  label: string
  /** The median over runs, like a budget line's. */
  measured: number | null
  readings: (number | null)[]
  unit: InfoUnit
  note?: string
}

export type BudgetReport = { pass: boolean; lines: BudgetLine[]; info: InfoLine[] }

/** What a failed or incomplete run says about itself: Lighthouse's own error, warnings, audit errors. */
export type Diagnostics = {
  /** `code: message` of lhr.runtimeError, or null when Lighthouse reported none. */
  runtimeError: string | null
  /** lhr.runWarnings as they come. */
  warnings: string[]
  /** `audit "<id>": <errorMessage>` for each audit of AUDIT_IDS that reports an error. */
  auditErrors: string[]
}

/** The budget file is malformed: a typed error at the boundary, never a silent default. */
export class BudgetFileError extends Error {
  override readonly name = 'BudgetFileError'
}

/**
 * The four lines of the budget, in report order; the limit names the key in perf/budget.json.
 * Line 1 reads the `title-screen-interactive` mark (recorded after hydrateRoot committed and the
 * handlers exist) since T5a: Lighthouse's TTI, the Phase 0b provisional instrument, would count
 * the World chunk's evaluation (plan §7) and stays printed below as information. The fourth line
 * is line 1's condition (b): the chunk evaluates after the mark, so the main thread must stay
 * usable meanwhile.
 */
const LINE_SPECS: readonly {
  id: BudgetLineId
  label: string
  unit: Unit
  limit: keyof Limits
  gated: boolean
  strict: boolean
}[] = [
  {
    id: 'title-screen-interactive',
    label: 'Title Screen interactive',
    unit: 'ms',
    limit: 'titleScreenInteractiveMs',
    gated: true,
    strict: false,
  },
  {
    id: 'world-playable',
    label: 'World playable',
    unit: 'ms',
    limit: 'worldPlayableMs',
    gated: true,
    strict: false,
  },
  {
    id: 'download-until-playable',
    label: 'Download until playable',
    unit: 'B',
    limit: 'downloadUntilPlayableBytes',
    gated: true,
    strict: false,
  },
  {
    id: 'long-task-between-marks',
    label: 'Longest task between marks',
    unit: 'ms',
    limit: 'longTaskBetweenMarksMs',
    gated: true,
    strict: true,
  },
]

/** The audits the run asks Lighthouse for (`onlyAudits` in scripts/perf-budget.ts). */
export const AUDIT_IDS = [
  'interactive',
  'user-timings',
  'network-requests',
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
  'long-tasks',
] as const

type AuditId = (typeof AUDIT_IDS)[number]

/** The informational readings, in report order, each from one requested audit's numericValue. */
const INFO_SPECS: readonly { id: InfoLineId; label: string; audit: AuditId; unit: InfoUnit }[] = [
  { id: 'tti', label: 'TTI (informational)', audit: 'interactive', unit: 'ms' },
  { id: 'lcp', label: 'LCP (informational)', audit: 'largest-contentful-paint', unit: 'ms' },
  { id: 'cls', label: 'CLS (informational)', audit: 'cumulative-layout-shift', unit: 'score' },
  { id: 'tbt', label: 'TBT (informational)', audit: 'total-blocking-time', unit: 'ms' },
]

const THROTTLING_KEYS = [
  'rttMs',
  'throughputKbps',
  'requestLatencyMs',
  'downloadThroughputKbps',
  'uploadThroughputKbps',
  'cpuSlowdownMultiplier',
] as const
const LIMIT_KEYS = [
  'titleScreenInteractiveMs',
  'worldPlayableMs',
  'downloadUntilPlayableBytes',
  'longTaskBetweenMarksMs',
] as const

/**
 * The download line excludes requests by URL path prefix, never by resource type (plan §7): the
 * Exhibit media under /media/exhibits/<id>/ is outside the budget (spec, AC-4.3), while World
 * textures, icons and the preview image count. A request without a parsable URL counts.
 */
const EXCLUDED_PATH_PREFIX = '/media/exhibits/'

function isExcludedUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !URL.canParse(url)) return false
  return new URL(url).pathname.startsWith(EXCLUDED_PATH_PREFIX)
}

/** A plain object (not an array): the shape every Lighthouse node is narrowed through. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numbersOf<K extends string>(
  section: unknown,
  keys: readonly K[],
  where: string,
): Record<K, number> {
  if (!isRecord(section)) {
    throw new BudgetFileError(`perf/budget.json: "${where}" must be an object`)
  }
  const out: Partial<Record<K, number>> = {}
  for (const key of keys) {
    const value = section[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BudgetFileError(`perf/budget.json: "${where}.${key}" must be a non-negative number`)
    }
    out[key] = value
  }
  return out as Record<K, number>
}

/** Validates the parsed budget file. */
export function parseBudget(raw: unknown): Budget {
  if (!isRecord(raw)) {
    throw new BudgetFileError('perf/budget.json: the file must contain an object')
  }
  return {
    throttling: numbersOf(raw['throttling'], THROTTLING_KEYS, 'throttling'),
    limits: numbersOf(raw['limits'], LIMIT_KEYS, 'limits'),
  }
}

type Measurement = { value: number | null; note?: string }

/** `base` with the measurement's note, when it has one (exactOptionalPropertyTypes: never `note: undefined`). */
function withNote<T extends object>(base: T, m: Measurement): T & { note?: string } {
  return m.note === undefined ? base : { ...base, note: m.note }
}

function line(
  spec: (typeof LINE_SPECS)[number],
  limits: Limits,
  m: Measurement,
  readings: (number | null)[] = [m.value],
): BudgetLine {
  const limit = limits[spec.limit]
  return withNote(
    {
      id: spec.id,
      label: spec.label,
      measured: m.value,
      readings,
      limit,
      unit: spec.unit,
      pass: m.value !== null && (spec.strict ? m.value < limit : m.value <= limit),
      gated: spec.gated,
      strict: spec.strict,
    },
    m,
  )
}

function infoLine(
  spec: (typeof INFO_SPECS)[number],
  m: Measurement,
  readings: (number | null)[] = [m.value],
): InfoLine {
  return withNote(
    { id: spec.id, label: spec.label, measured: m.value, readings, unit: spec.unit },
    m,
  )
}

/** The run passes when every gated line passes; an informational line never decides. */
function passes(lines: readonly BudgetLine[]): boolean {
  return lines.every((l) => l.pass || !l.gated)
}

function auditOf(lhr: unknown, id: string): Record<string, unknown> | undefined {
  if (!isRecord(lhr) || !isRecord(lhr['audits'])) return undefined
  const audit = lhr['audits'][id]
  return isRecord(audit) ? audit : undefined
}

function itemsOf(audit: Record<string, unknown> | undefined): unknown[] | undefined {
  if (audit === undefined || !isRecord(audit['details'])) return undefined
  const items = audit['details']['items']
  return Array.isArray(items) ? items : undefined
}

/** An audit's numericValue (TTI and the informational readings), or null with the reason. */
function numericValue(lhr: unknown, auditId: AuditId): Measurement {
  const value = auditOf(lhr, auditId)?.['numericValue']
  return typeof value === 'number'
    ? { value }
    : { value: null, note: `audit "${auditId}" has no numericValue` }
}

/** Start time of the user-timing mark `name` in ms from navigation start, or null with the reason. */
function markStart(lhr: unknown, name: string): Measurement {
  const items = itemsOf(auditOf(lhr, 'user-timings'))
  if (items === undefined) return { value: null, note: 'audit "user-timings" is missing' }
  for (const item of items) {
    if (
      isRecord(item) &&
      item['name'] === name &&
      item['timingType'] === 'Mark' &&
      typeof item['startTime'] === 'number'
    ) {
      return { value: item['startTime'] }
    }
  }
  return { value: null, note: `mark "${name}" not recorded` }
}

/**
 * Bytes transferred by every request that finished before the mark, Exhibit media excluded by prefix.
 * Lighthouse reports request times relative to the earliest request and the mark relative to
 * navigation start; the main document is that earliest request, so the offset is far below the
 * resolution that matters for a megabyte-scale line.
 */
function downloadUntilPlayable(lhr: unknown, mark: Measurement): Measurement {
  if (mark.value === null) return { value: null, note: 'needs the world-playable mark' }
  const items = itemsOf(auditOf(lhr, 'network-requests'))
  if (items === undefined) return { value: null, note: 'audit "network-requests" is missing' }
  let bytes = 0
  for (const item of items) {
    if (!isRecord(item)) continue
    const { transferSize, networkEndTime, url } = item
    if (typeof transferSize !== 'number' || typeof networkEndTime !== 'number') continue
    if (networkEndTime > mark.value) continue
    if (isExcludedUrl(url)) continue
    bytes += transferSize
  }
  return { value: bytes }
}

/**
 * The longest main-thread task that starts between the two marks, in ms, 0 when none. Lighthouse's
 * `long-tasks` audit lists top-level tasks of 50 ms or more, the 20 longest, with `startTime` and
 * `duration` in ms from the same time origin as the marks (read in its source on #29); a task
 * between the marks could only hide behind twenty longer ones elsewhere, which TBT would show.
 */
function longestTaskBetween(lhr: unknown, from: Measurement, to: Measurement): Measurement {
  if (from.value === null) return { value: null, note: 'needs the title-screen-interactive mark' }
  if (to.value === null) return { value: null, note: 'needs the world-playable mark' }
  const items = itemsOf(auditOf(lhr, 'long-tasks'))
  if (items === undefined) return { value: null, note: 'audit "long-tasks" is missing' }
  let longest = 0
  for (const item of items) {
    if (!isRecord(item)) continue
    const { startTime, duration } = item
    if (typeof startTime !== 'number' || typeof duration !== 'number') continue
    if (startTime < from.value || startTime > to.value) continue
    longest = Math.max(longest, duration)
  }
  return { value: longest }
}

/** Evaluates the four budget lines and the informational readings against a Lighthouse result (`lhr`, taken as untrusted). */
export function evaluateBudget(lhr: unknown, budget: Budget): BudgetReport {
  const interactive = markStart(lhr, TITLE_SCREEN_INTERACTIVE_MARK)
  const playable = markStart(lhr, WORLD_PLAYABLE_MARK)
  const measurements: Record<BudgetLineId, Measurement> = {
    'title-screen-interactive': interactive,
    'world-playable': playable,
    'download-until-playable': downloadUntilPlayable(lhr, playable),
    'long-task-between-marks': longestTaskBetween(lhr, interactive, playable),
  }
  const lines = LINE_SPECS.map((spec) => line(spec, budget.limits, measurements[spec.id]))
  const info = INFO_SPECS.map((spec) => infoLine(spec, numericValue(lhr, spec.audit)))
  return { pass: passes(lines), lines, info }
}

/**
 * What the result says about a failed or incomplete run (`lhr` taken as untrusted): the runner
 * prints it next to the lines so the next flake carries its cause (Owner decision on #41).
 */
export function diagnose(lhr: unknown): Diagnostics {
  const result = isRecord(lhr) ? lhr : {}
  const runtimeError = result['runtimeError']
  const message = isRecord(runtimeError) ? runtimeError['message'] : undefined
  const code = isRecord(runtimeError) ? runtimeError['code'] : undefined
  const warnings = Array.isArray(result['runWarnings'])
    ? result['runWarnings'].filter((w): w is string => typeof w === 'string')
    : []
  const auditErrors: string[] = []
  for (const id of AUDIT_IDS) {
    const error = auditOf(lhr, id)?.['errorMessage']
    if (typeof error === 'string') auditErrors.push(`audit "${id}": ${error}`)
  }
  return {
    runtimeError:
      typeof message === 'string'
        ? typeof code === 'string'
          ? `${code}: ${message}`
          : message
        : null,
    warnings,
    auditErrors,
  }
}

/** One text line per diagnostic; one line saying so when Lighthouse reported nothing. */
export function formatDiagnostics(d: Diagnostics): string[] {
  const lines = [
    ...(d.runtimeError === null ? [] : [`  runtimeError: ${d.runtimeError}`]),
    ...d.warnings.map((w) => `  runWarning: ${w}`),
    ...d.auditErrors.map((e) => `  ${e}`),
  ]
  return lines.length === 0 ? ['  no runtimeError, no runWarnings, no audit error reported'] : lines
}

/**
 * The median of a line's readings over runs (ADR 0013): a missing reading (a run without a value)
 * sorts above every number, and an even count takes the upper of the two middle readings, so the
 * gate never averages two runs into a value no run measured. One reading is its own median; none
 * has no median. With three runs, one missing or busy run does not decide a line; two do.
 */
export function medianOf(readings: readonly (number | null)[]): number | null {
  const sorted = [...readings].sort((a, b) =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b,
  )
  return sorted[Math.floor(sorted.length / 2)] ?? null
}

/** The median measurement of the same line across runs; without a value, the first missing run's note. */
function medianMeasurement(runs: readonly (BudgetLine | InfoLine | undefined)[]): {
  m: Measurement
  readings: (number | null)[]
} {
  const readings = runs.flatMap((l) => (l === undefined ? [null] : l.readings))
  const value = medianOf(readings)
  if (value !== null) return { m: { value }, readings }
  const note = runs.find((l) => l?.measured === null && l.note !== undefined)?.note ?? 'no run'
  return { m: { value: null, note }, readings }
}

/**
 * One report over several runs (ADR 0013): each budget line and informational reading is the median
 * of the runs' readings, and a budget line's verdict is decided on that median, with the same strict
 * or inclusive bound as a single run. A run that produced no result enters as its `failedReport`.
 */
export function combineRuns(reports: readonly BudgetReport[], budget: Budget): BudgetReport {
  const lines = LINE_SPECS.map((spec) => {
    const { m, readings } = medianMeasurement(
      reports.map((r) => r.lines.find((l) => l.id === spec.id)),
    )
    return line(spec, budget.limits, m, readings)
  })
  const info = INFO_SPECS.map((spec) => {
    const { m, readings } = medianMeasurement(
      reports.map((r) => r.info.find((l) => l.id === spec.id)),
    )
    return infoLine(spec, m, readings)
  })
  return { pass: passes(lines), lines, info }
}

/** The report for a run that produced no result at all: every line fails with the same note. */
export function failedReport(budget: Budget, note: string): BudgetReport {
  return {
    pass: false,
    lines: LINE_SPECS.map((spec) => line(spec, budget.limits, { value: null, note })),
    info: INFO_SPECS.map((spec) => infoLine(spec, { value: null, note })),
  }
}

/** A value without its unit: ms rounded, bytes with thousands separators, a score to three places. */
function figure(value: number, unit: Unit | InfoUnit): string {
  switch (unit) {
    case 'ms':
      return String(Math.round(value))
    case 'B':
      return value.toLocaleString('en-US')
    case 'score':
      return value.toFixed(3)
  }
}

function unitSuffix(unit: Unit | InfoUnit): string {
  return unit === 'score' ? '' : ` ${unit}`
}

function amount(value: number, unit: Unit | InfoUnit): string {
  return `${figure(value, unit)}${unitSuffix(unit)}`
}

/** Every run's reading in run order, n/a for a run without one: `(runs: 268 · 73 · 99 ms)`. */
function runsOf(l: BudgetLine | InfoLine): string {
  const figures = l.readings.map((r) => (r === null ? 'n/a' : figure(r, l.unit)))
  const suffix = l.readings.some((r) => r !== null) ? unitSuffix(l.unit) : ''
  return `   (runs: ${figures.join(' · ')}${suffix})`
}

/** pass / FAIL on a gated line; pass / over (or n/a without a value) on an informational one. */
function verdictOf(l: BudgetLine): string {
  if (l.pass) return 'pass'
  if (l.gated) return 'FAIL'
  return l.measured === null ? 'n/a' : 'over'
}

const LABEL_WIDTH = 26
const VALUE_WIDTH = 14

/** The columns every printed line opens with: the label and the measured value, or n/a. */
function cells(l: BudgetLine | InfoLine): string {
  const measured = l.measured === null ? 'n/a' : amount(l.measured, l.unit)
  return `  ${l.label.padEnd(LABEL_WIDTH)} ${measured.padStart(VALUE_WIDTH)}`
}

function noteOf(l: BudgetLine | InfoLine): string {
  return l.note === undefined ? '' : ` (${l.note})`
}

/**
 * One text line per budget line (label, median, limit, verdict, every run's reading; always all
 * four), then one per informational reading (label, median, every run's reading; no limit, no
 * verdict).
 */
export function formatReport(report: BudgetReport): string[] {
  const budgetLines = report.lines.map((l) => {
    const tag = l.gated ? '' : '   informational'
    const bound = l.strict ? '< ' : ''
    return `${cells(l)}   limit ${bound}${amount(l.limit, l.unit)}   ${verdictOf(l)}${tag}${noteOf(l)}${runsOf(l)}`
  })
  const infoLines = report.info.map((l) => `${cells(l)}${noteOf(l)}${runsOf(l)}`)
  return [...budgetLines, ...infoLines]
}
