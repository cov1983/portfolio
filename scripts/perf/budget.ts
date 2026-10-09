// Pure evaluation of the CI performance budget (docs/spec/increment-1.md, Non-functional
// requirements) against a Lighthouse result. No I/O: the runner (scripts/perf-budget.ts) reads the
// budget file and runs Lighthouse, then prints what comes back from here. Every budget line is
// always reported, also when its input is missing or the run failed, so a breach never hides
// behind an error (Phase 0b plan, Owner decision 5).
import { WORLD_PLAYABLE_MARK } from '../../src/perf/world-playable.ts'

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
  pass: boolean
  note?: string
}

export type BudgetReport = { pass: boolean; lines: BudgetLine[] }

/** The budget file is malformed: a typed error at the boundary, never a silent default. */
export class BudgetFileError extends Error {
  override readonly name = 'BudgetFileError'
}

/** The three lines of the budget, in report order; the limit names the key in perf/budget.json. */
const LINE_SPECS: readonly { id: BudgetLineId; label: string; unit: Unit; limit: keyof Limits }[] =
  [
    {
      id: 'title-screen-interactive',
      label: 'Title Screen interactive',
      unit: 'ms',
      limit: 'titleScreenInteractiveMs',
    },
    { id: 'world-playable', label: 'World playable', unit: 'ms', limit: 'worldPlayableMs' },
    {
      id: 'download-until-playable',
      label: 'Download until playable',
      unit: 'B',
      limit: 'downloadUntilPlayableBytes',
    },
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
] as const

/** Resources that the download line excludes: Exhibit media is outside the budget (spec). */
const EXCLUDED_RESOURCE_TYPES = new Set(['Image', 'Media'])

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
  }
  return m.note === undefined ? base : { ...base, note: m.note }
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
 * Bytes transferred by every request that finished before the mark, Exhibit media excluded.
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
    const { transferSize, networkEndTime, resourceType } = item
    if (typeof transferSize !== 'number' || typeof networkEndTime !== 'number') continue
    if (networkEndTime > mark.value) continue
    if (typeof resourceType === 'string' && EXCLUDED_RESOURCE_TYPES.has(resourceType)) continue
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
  return { pass: lines.every((l) => l.pass), lines }
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

/** One text line per budget line: label, measured, limit, verdict. Always all three. */
export function formatReport(report: BudgetReport): string[] {
  return report.lines.map((l) => {
    const measured = l.measured === null ? 'n/a' : amount(l.measured, l.unit)
    const note = l.note === undefined ? '' : ` (${l.note})`
    return `  ${l.label.padEnd(26)} ${measured.padStart(14)}   limit ${amount(l.limit, l.unit)}   ${l.pass ? 'pass' : 'FAIL'}${note}`
  })
}
