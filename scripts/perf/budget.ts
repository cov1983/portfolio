// Pure evaluation of the CI performance budget (docs/spec/increment-1.md, Non-functional
// requirements) against a Lighthouse result. No I/O: the runner (scripts/perf-budget.ts) reads the
// budget file and runs Lighthouse, then prints what comes back from here. Every budget line is
// always reported, also when its input is missing or the run failed, so a breach never hides
// behind an error (Phase 0b plan, Owner decision 5). All three lines are gated (their breach fails
// the run); TTI, LCP, CLS and TBT follow as informational lines that never decide (plan §7).
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
}

export type Budget = { throttling: Throttling; limits: Limits }

export type BudgetLineId = 'title-screen-interactive' | 'world-playable' | 'download-until-playable'

export type Unit = 'ms' | 'B'

export type BudgetLine = {
  id: BudgetLineId
  label: string
  /** null when the run produced no value for this line; the note says why. */
  measured: number | null
  limit: number
  unit: Unit
  /** measured ≤ limit. */
  pass: boolean
  /** A gated line's breach fails the run; every line is gated since T5a (plan §7). */
  gated: boolean
  note?: string
}

export type InfoLineId = 'tti' | 'lcp' | 'cls' | 'tbt'

/** `score` is a unitless Lighthouse value (CLS). */
export type InfoUnit = 'ms' | 'score'

/** A reading printed next to the budget, with no limit and no verdict: a regression is read across runs. */
export type InfoLine = {
  id: InfoLineId
  label: string
  measured: number | null
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
 * The three lines of the budget, in report order; the limit names the key in perf/budget.json.
 * Line 1 reads the `title-screen-interactive` mark (recorded after hydrateRoot committed and the
 * handlers exist) since T5a: Lighthouse's TTI, the Phase 0b provisional instrument, counts the
 * World chunk's evaluation at `/?world` (plan §7) and stays printed below as information.
 */
const LINE_SPECS: readonly {
  id: BudgetLineId
  label: string
  unit: Unit
  limit: keyof Limits
  gated: boolean
}[] = [
  {
    id: 'title-screen-interactive',
    label: 'Title Screen interactive',
    unit: 'ms',
    limit: 'titleScreenInteractiveMs',
    gated: true,
  },
  {
    id: 'world-playable',
    label: 'World playable',
    unit: 'ms',
    limit: 'worldPlayableMs',
    gated: true,
  },
  {
    id: 'download-until-playable',
    label: 'Download until playable',
    unit: 'B',
    limit: 'downloadUntilPlayableBytes',
    gated: true,
  },
]

/** The informational readings, in report order, each from one Lighthouse audit's numericValue. */
const INFO_SPECS: readonly { id: InfoLineId; label: string; audit: string; unit: InfoUnit }[] = [
  { id: 'tti', label: 'TTI (informational)', audit: 'interactive', unit: 'ms' },
  { id: 'lcp', label: 'LCP (informational)', audit: 'largest-contentful-paint', unit: 'ms' },
  { id: 'cls', label: 'CLS (informational)', audit: 'cumulative-layout-shift', unit: 'score' },
  { id: 'tbt', label: 'TBT (informational)', audit: 'total-blocking-time', unit: 'ms' },
]

/** The audits the run asks Lighthouse for (`onlyAudits` in scripts/perf-budget.ts). */
export const AUDIT_IDS = [
  'interactive',
  'user-timings',
  'network-requests',
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
] as const

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

function line(spec: (typeof LINE_SPECS)[number], limits: Limits, m: Measurement): BudgetLine {
  const limit = limits[spec.limit]
  const base = {
    id: spec.id,
    label: spec.label,
    measured: m.value,
    limit,
    unit: spec.unit,
    pass: m.value !== null && m.value <= limit,
    gated: spec.gated,
  }
  return m.note === undefined ? base : { ...base, note: m.note }
}

function infoLine(spec: (typeof INFO_SPECS)[number], m: Measurement): InfoLine {
  const base = { id: spec.id, label: spec.label, measured: m.value, unit: spec.unit }
  return m.note === undefined ? base : { ...base, note: m.note }
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
function numericValue(lhr: unknown, auditId: string): Measurement {
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

/** Evaluates the three budget lines and the informational readings against a Lighthouse result (`lhr`, taken as untrusted). */
export function evaluateBudget(lhr: unknown, budget: Budget): BudgetReport {
  const playable = markStart(lhr, WORLD_PLAYABLE_MARK)
  const measurements: Record<BudgetLineId, Measurement> = {
    'title-screen-interactive': markStart(lhr, TITLE_SCREEN_INTERACTIVE_MARK),
    'world-playable': playable,
    'download-until-playable': downloadUntilPlayable(lhr, playable),
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

/** The report for a run that produced no result at all: every line fails with the same note. */
export function failedReport(budget: Budget, note: string): BudgetReport {
  return {
    pass: false,
    lines: LINE_SPECS.map((spec) => line(spec, budget.limits, { value: null, note })),
    info: INFO_SPECS.map((spec) => infoLine(spec, { value: null, note })),
  }
}

function amount(value: number, unit: Unit | InfoUnit): string {
  switch (unit) {
    case 'ms':
      return `${String(Math.round(value))} ms`
    case 'B':
      return `${value.toLocaleString('en-US')} B`
    case 'score':
      return value.toFixed(3)
  }
}

/** pass / FAIL on a gated line; pass / over (or n/a without a value) on an informational one. */
function verdictOf(l: BudgetLine): string {
  if (l.pass) return 'pass'
  if (l.gated) return 'FAIL'
  return l.measured === null ? 'n/a' : 'over'
}

const LABEL_WIDTH = 26
const VALUE_WIDTH = 14

/**
 * One text line per budget line (label, measured, limit, verdict; always all three), then one per
 * informational reading (label, measured; no limit, no verdict).
 */
export function formatReport(report: BudgetReport): string[] {
  const budgetLines = report.lines.map((l) => {
    const measured = l.measured === null ? 'n/a' : amount(l.measured, l.unit)
    const tag = l.gated ? '' : '   informational'
    const note = l.note === undefined ? '' : ` (${l.note})`
    return `  ${l.label.padEnd(LABEL_WIDTH)} ${measured.padStart(VALUE_WIDTH)}   limit ${amount(l.limit, l.unit)}   ${verdictOf(l)}${tag}${note}`
  })
  const infoLines = report.info.map((l) => {
    const measured = l.measured === null ? 'n/a' : amount(l.measured, l.unit)
    const note = l.note === undefined ? '' : ` (${l.note})`
    return `  ${l.label.padEnd(LABEL_WIDTH)} ${measured.padStart(VALUE_WIDTH)}${note}`
  })
  return [...budgetLines, ...infoLines]
}
