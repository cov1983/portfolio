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

export type Budget = {
  throttling: Throttling
  limits: {
    titleScreenInteractiveMs: number
    worldPlayableMs: number
    downloadUntilPlayableBytes: number
  }
}

export type BudgetLineId = 'title-screen-interactive' | 'world-playable' | 'download-until-playable'

export type BudgetLine = {
  id: BudgetLineId
  label: string
  /** null when the run produced no value for this line; the note says why. */
  measured: number | null
  limit: number
  unit: 'ms' | 'B'
  pass: boolean
  note?: string
}

export type BudgetReport = { pass: boolean; lines: BudgetLine[] }

/** The budget file is malformed: a typed error at the boundary, never a silent default. */
export class BudgetFileError extends Error {
  override readonly name = 'BudgetFileError'
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
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

function line(
  id: BudgetLineId,
  label: string,
  measured: number | null,
  limit: number,
  unit: 'ms' | 'B',
  note?: string,
): BudgetLine {
  const base = { id, label, measured, limit, unit, pass: measured !== null && measured <= limit }
  return note === undefined ? base : { ...base, note }
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

/** Start time of the world-playable mark in ms from navigation start, or null with the reason. */
function worldPlayableAt(lhr: unknown): { at: number | null; note?: string } {
  const items = itemsOf(auditOf(lhr, 'user-timings'))
  if (items === undefined) return { at: null, note: 'audit "user-timings" is missing' }
  for (const item of items) {
    if (
      isRecord(item) &&
      item['name'] === WORLD_PLAYABLE_MARK &&
      item['timingType'] === 'Mark' &&
      typeof item['startTime'] === 'number'
    ) {
      return { at: item['startTime'] }
    }
  }
  return { at: null, note: `mark "${WORLD_PLAYABLE_MARK}" not recorded` }
}

/**
 * Bytes transferred by every request that finished before the mark, Exhibit media excluded.
 * Lighthouse reports request times relative to the earliest request and the mark relative to
 * navigation start; the main document is that earliest request, so the offset is far below the
 * resolution that matters for a MiB-scale line.
 */
function downloadUntil(lhr: unknown, markAt: number): { bytes: number | null; note?: string } {
  const items = itemsOf(auditOf(lhr, 'network-requests'))
  if (items === undefined) return { bytes: null, note: 'audit "network-requests" is missing' }
  let bytes = 0
  for (const item of items) {
    if (!isRecord(item)) continue
    const { transferSize, networkEndTime, resourceType } = item
    if (typeof transferSize !== 'number' || typeof networkEndTime !== 'number') continue
    if (networkEndTime > markAt) continue
    if (typeof resourceType === 'string' && EXCLUDED_RESOURCE_TYPES.has(resourceType)) continue
    bytes += transferSize
  }
  return { bytes }
}

/** Evaluates the three budget lines against a Lighthouse result (`lhr`, taken as untrusted). */
export function evaluateBudget(lhr: unknown, budget: Budget): BudgetReport {
  const { limits } = budget

  const interactive = auditOf(lhr, 'interactive')?.['numericValue']
  const titleScreen = line(
    'title-screen-interactive',
    'Title Screen interactive',
    typeof interactive === 'number' ? interactive : null,
    limits.titleScreenInteractiveMs,
    'ms',
    typeof interactive === 'number' ? undefined : 'audit "interactive" has no numericValue',
  )

  const mark = worldPlayableAt(lhr)
  const playable = line(
    'world-playable',
    'World playable',
    mark.at,
    limits.worldPlayableMs,
    'ms',
    mark.note,
  )

  const download =
    mark.at === null
      ? { bytes: null, note: 'needs the world-playable mark' }
      : downloadUntil(lhr, mark.at)
  const until = line(
    'download-until-playable',
    'Download until playable',
    download.bytes,
    limits.downloadUntilPlayableBytes,
    'B',
    download.note,
  )

  const lines = [titleScreen, playable, until]
  return { pass: lines.every((l) => l.pass), lines }
}

/** The report for a run that produced no result at all: every line fails with the same note. */
export function failedReport(budget: Budget, note: string): BudgetReport {
  const { limits } = budget
  return {
    pass: false,
    lines: [
      line(
        'title-screen-interactive',
        'Title Screen interactive',
        null,
        limits.titleScreenInteractiveMs,
        'ms',
        note,
      ),
      line('world-playable', 'World playable', null, limits.worldPlayableMs, 'ms', note),
      line(
        'download-until-playable',
        'Download until playable',
        null,
        limits.downloadUntilPlayableBytes,
        'B',
        note,
      ),
    ],
  }
}

function amount(value: number, unit: 'ms' | 'B'): string {
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
