// Pure evaluation of the CI performance budget (docs/spec/increment-1.md, Non-functional
// requirements) against a Lighthouse result. No I/O: the runner (scripts/perf-budget.ts) reads the
// budget file and runs Lighthouse, then prints what comes back from here. Every budget line is
// always reported, also when its input is missing or the run failed, so a breach never hides
// behind an error (Phase 0b plan, Owner decision 5). A line is either gated (its breach fails the
// run) or informational (printed, never failing): see LINE_SPECS.
import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks.ts'

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
  /** measured ≤ limit. On an informational line this is printed, never a reason to fail the run. */
  pass: boolean
  /** false: the line is informational until the ticket named in its note re-gates it. */
  gated: boolean
  note?: string
}

export type BudgetReport = { pass: boolean; lines: BudgetLine[] }

/** What a failed or incomplete run says about itself: Lighthouse's own error, warnings, audit errors. */
export type Diagnostics = {
  /** `code: message` of lhr.runtimeError, or null when Lighthouse reported none. */
  runtimeError: string | null
  /** lhr.runWarnings as they come. */
  warnings: string[]
  /** `audit "<id>": <errorMessage>` for each of the three audits that reports an error. */
  auditErrors: string[]
}

/** The tag printed after an informational line's verdict (Owner decision on #41, 2026-10-11). */
export const INFORMATIONAL_UNTIL = 'informational until T5a (plan §7)'

/** The budget file is malformed: a typed error at the boundary, never a silent default. */
export class BudgetFileError extends Error {
  override readonly name = 'BudgetFileError'
}

/**
 * The three lines of the budget, in report order; the limit names the key in perf/budget.json.
 * Line 1 reads Lighthouse's TTI, the Phase 0b provisional instrument, which counts the World
 * chunk's evaluation at `/?world` (plan §7: the artefact the mark exists to avoid). Owner decision
 * on #41 (2026-10-11): from T1 the line is informational, printed with its limit and never failing
 * the run; T5a switches it to the `title-screen-interactive` mark and sets `gated: true` again.
 * Lines 2 and 3 stay gated.
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
    gated: false,
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

/** The audits the run asks Lighthouse for (`onlyAudits` in scripts/perf-budget.ts). */
const AUDIT_IDS = ['interactive', 'user-timings', 'network-requests'] as const

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

/** Time to interactive from the `interactive` audit (still computed in Lighthouse 13, only hidden). */
function titleScreenInteractive(lhr: unknown): Measurement {
  const value = auditOf(lhr, 'interactive')?.['numericValue']
  return typeof value === 'number'
    ? { value }
    : { value: null, note: 'audit "interactive" has no numericValue' }
}

/** Start time of the world-playable mark in ms from navigation start, or null with the reason. */
function worldPlayable(lhr: unknown): Measurement {
  const items = itemsOf(auditOf(lhr, 'user-timings'))
  if (items === undefined) return { value: null, note: 'audit "user-timings" is missing' }
  for (const item of items) {
    if (
      isRecord(item) &&
      item['name'] === WORLD_PLAYABLE_MARK &&
      item['timingType'] === 'Mark' &&
      typeof item['startTime'] === 'number'
    ) {
      return { value: item['startTime'] }
    }
  }
  return { value: null, note: `mark "${WORLD_PLAYABLE_MARK}" not recorded` }
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

/** Evaluates the three budget lines against a Lighthouse result (`lhr`, taken as untrusted). */
export function evaluateBudget(lhr: unknown, budget: Budget): BudgetReport {
  const mark = worldPlayable(lhr)
  const measurements: Record<BudgetLineId, Measurement> = {
    'title-screen-interactive': titleScreenInteractive(lhr),
    'world-playable': mark,
    'download-until-playable': downloadUntilPlayable(lhr, mark),
  }
  const lines = LINE_SPECS.map((spec) => line(spec, budget.limits, measurements[spec.id]))
  return { pass: passes(lines), lines }
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
  }
}

function amount(value: number, unit: Unit): string {
  return unit === 'ms' ? `${String(Math.round(value))} ms` : `${value.toLocaleString('en-US')} B`
}

/** pass / FAIL on a gated line; pass / over (or n/a without a value) on an informational one. */
function verdictOf(l: BudgetLine): string {
  if (l.pass) return 'pass'
  if (l.gated) return 'FAIL'
  return l.measured === null ? 'n/a' : 'over'
}

/** One text line per budget line: label, measured, limit, verdict, gating tag. Always all three. */
export function formatReport(report: BudgetReport): string[] {
  return report.lines.map((l) => {
    const measured = l.measured === null ? 'n/a' : amount(l.measured, l.unit)
    const tag = l.gated ? '' : `   ${INFORMATIONAL_UNTIL}`
    const note = l.note === undefined ? '' : ` (${l.note})`
    return `  ${l.label.padEnd(26)} ${measured.padStart(14)}   limit ${amount(l.limit, l.unit)}   ${verdictOf(l)}${tag}${note}`
  })
}
