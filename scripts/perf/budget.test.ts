import { describe, expect, it } from 'vitest'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/world-playable.ts'
import {
  BudgetFileError,
  evaluateBudget,
  failedReport,
  formatReport,
  parseBudget,
  type Budget,
  type BudgetLineId,
} from './budget.ts'

const budget: Budget = {
  throttling: {
    rttMs: 40,
    throughputKbps: 10240,
    requestLatencyMs: 40,
    downloadThroughputKbps: 10240,
    uploadThroughputKbps: 5120,
    cpuSlowdownMultiplier: 1,
  },
  limits: {
    titleScreenInteractiveMs: 2000,
    worldPlayableMs: 5000,
    downloadUntilPlayableBytes: 4096,
  },
}

type Request = { transferSize: number; networkEndTime: number; resourceType?: string }

/** A Lighthouse result reduced to the three audits the budget reads. */
function lhr(opts: { interactive?: number; markAt?: number; requests?: Request[] } = {}): unknown {
  const { interactive = 1000, markAt = 3000, requests = [] } = opts
  const marks = [{ name: WORLD_PLAYABLE_MARK, timingType: 'Mark', startTime: markAt }]
  return {
    audits: {
      interactive: { numericValue: interactive },
      'user-timings': { details: { items: marks } },
      'network-requests': { details: { items: requests } },
    },
  }
}

function lineById(report: ReturnType<typeof evaluateBudget>, id: BudgetLineId) {
  const found = report.lines.find((l) => l.id === id)
  if (found === undefined) throw new Error(`no line ${id}`)
  return found
}

describe('evaluateBudget', () => {
  it('passes when every line is under its limit', () => {
    const report = evaluateBudget(
      lhr({ requests: [{ transferSize: 1000, networkEndTime: 100 }] }),
      budget,
    )
    expect(report.pass).toBe(true)
  })

  it('always reports the three lines in order', () => {
    const report = evaluateBudget({}, budget)
    expect(report.lines.map((l) => l.id)).toEqual([
      'title-screen-interactive',
      'world-playable',
      'download-until-playable',
    ])
  })

  it('reads Title Screen interactive from the interactive audit', () => {
    expect(
      lineById(evaluateBudget(lhr({ interactive: 1234.5 }), budget), 'title-screen-interactive')
        .measured,
    ).toBe(1234.5)
  })

  it('fails Title Screen interactive above the limit', () => {
    expect(
      lineById(evaluateBudget(lhr({ interactive: 2000.1 }), budget), 'title-screen-interactive')
        .pass,
    ).toBe(false)
  })

  it('passes a line that sits exactly on its limit', () => {
    expect(
      lineById(evaluateBudget(lhr({ interactive: 2000 }), budget), 'title-screen-interactive').pass,
    ).toBe(true)
  })

  it('reads World playable from the world-playable mark', () => {
    expect(lineById(evaluateBudget(lhr({ markAt: 4321 }), budget), 'world-playable').measured).toBe(
      4321,
    )
  })

  it('fails World playable above the limit', () => {
    expect(lineById(evaluateBudget(lhr({ markAt: 5001 }), budget), 'world-playable').pass).toBe(
      false,
    )
  })

  it('ignores a measure that happens to carry the mark name', () => {
    const result = {
      audits: {
        'user-timings': {
          details: { items: [{ name: WORLD_PLAYABLE_MARK, timingType: 'Measure', startTime: 1 }] },
        },
      },
    }
    expect(lineById(evaluateBudget(result, budget), 'world-playable').measured).toBeNull()
  })

  it('fails World playable with a note when the mark is missing', () => {
    const result = { audits: { 'user-timings': { details: { items: [] } } } }
    const playable = lineById(evaluateBudget(result, budget), 'world-playable')
    expect(playable).toMatchObject({
      measured: null,
      pass: false,
      note: `mark "${WORLD_PLAYABLE_MARK}" not recorded`,
    })
  })

  it('sums the transfer size of requests finished before the mark', () => {
    const requests = [
      { transferSize: 1000, networkEndTime: 100 },
      { transferSize: 2000, networkEndTime: 3000 },
    ]
    expect(
      lineById(evaluateBudget(lhr({ markAt: 3000, requests }), budget), 'download-until-playable')
        .measured,
    ).toBe(3000)
  })

  it('excludes requests that finish after the mark', () => {
    const requests = [
      { transferSize: 1000, networkEndTime: 100 },
      { transferSize: 2000, networkEndTime: 3001 },
    ]
    expect(
      lineById(evaluateBudget(lhr({ markAt: 3000, requests }), budget), 'download-until-playable')
        .measured,
    ).toBe(1000)
  })

  it('excludes Image and Media resources (Exhibit media is outside the budget)', () => {
    const requests = [
      { transferSize: 1000, networkEndTime: 100, resourceType: 'Script' },
      { transferSize: 2000, networkEndTime: 100, resourceType: 'Image' },
      { transferSize: 4000, networkEndTime: 100, resourceType: 'Media' },
    ]
    expect(
      lineById(evaluateBudget(lhr({ requests }), budget), 'download-until-playable').measured,
    ).toBe(1000)
  })

  it('fails the download line above the limit', () => {
    const requests = [{ transferSize: 4097, networkEndTime: 100 }]
    expect(
      lineById(evaluateBudget(lhr({ requests }), budget), 'download-until-playable').pass,
    ).toBe(false)
  })

  it('cannot compute the download line without the mark', () => {
    const result = {
      audits: {
        'network-requests': { details: { items: [{ transferSize: 1, networkEndTime: 1 }] } },
      },
    }
    expect(lineById(evaluateBudget(result, budget), 'download-until-playable')).toMatchObject({
      measured: null,
      pass: false,
      note: 'needs the world-playable mark',
    })
  })

  it('reports a missing audit as null with a note instead of throwing', () => {
    const result = { audits: { 'user-timings': { details: { items: [] } } } }
    expect(lineById(evaluateBudget(result, budget), 'title-screen-interactive')).toMatchObject({
      measured: null,
      pass: false,
      note: 'audit "interactive" has no numericValue',
    })
  })

  it('fails the report as a whole when one line fails', () => {
    expect(evaluateBudget(lhr({ markAt: 9000 }), budget).pass).toBe(false)
  })
})

describe('failedReport', () => {
  it('fails all three lines with the given note', () => {
    const report = failedReport(budget, 'error: Chrome did not start')
    expect(report.lines.map((l) => [l.measured, l.pass, l.note])).toEqual([
      [null, false, 'error: Chrome did not start'],
      [null, false, 'error: Chrome did not start'],
      [null, false, 'error: Chrome did not start'],
    ])
  })
})

describe('formatReport', () => {
  it('prints measured, limit and verdict for a passing line', () => {
    const [first] = formatReport(evaluateBudget(lhr({ interactive: 1234.4 }), budget))
    expect(first).toMatch(/Title Screen interactive\s+1234 ms\s+limit 2000 ms\s+pass$/)
  })

  it('prints n/a and the note for a line without a value', () => {
    const [, playable] = formatReport(evaluateBudget({}, budget))
    expect(playable).toMatch(
      /World playable\s+n\/a\s+limit 5000 ms\s+FAIL \(audit "user-timings" is missing\)$/,
    )
  })

  it('prints bytes with thousands separators', () => {
    const [, , download] = formatReport(
      evaluateBudget(lhr({ requests: [{ transferSize: 1234567, networkEndTime: 1 }] }), budget),
    )
    expect(download).toContain('1,234,567 B')
  })
})

describe('parseBudget', () => {
  const raw = {
    throttling: budget.throttling,
    limits: budget.limits,
    $comment: 'ignored',
  }

  it('returns the throttling profile and the limits', () => {
    expect(parseBudget(raw)).toEqual(budget)
  })

  it('rejects a file that is not an object', () => {
    expect(() => parseBudget([])).toThrow(BudgetFileError)
  })

  it('rejects a missing section', () => {
    expect(() => parseBudget({ throttling: budget.throttling })).toThrow(
      /"limits" must be an object/,
    )
  })

  it('rejects a limit that is not a non-negative number', () => {
    const broken = { ...raw, limits: { ...budget.limits, worldPlayableMs: '5000' } }
    expect(() => parseBudget(broken)).toThrow(
      /"limits.worldPlayableMs" must be a non-negative number/,
    )
  })
})
