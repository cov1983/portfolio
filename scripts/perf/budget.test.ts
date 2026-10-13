import { describe, expect, it } from 'vitest'

import { TITLE_SCREEN_INTERACTIVE_MARK, WORLD_PLAYABLE_MARK } from '../../src/perf/marks.ts'
import {
  BudgetFileError,
  diagnose,
  evaluateBudget,
  failedReport,
  formatDiagnostics,
  formatReport,
  parseBudget,
  type Budget,
  type BudgetLineId,
  type InfoLineId,
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
    longTaskBetweenMarksMs: 100,
  },
}

type Task = { startTime: number; duration: number; url?: string }

type Request = {
  transferSize: number
  networkEndTime: number
  url?: string
  resourceType?: string
}

type Readings = {
  interactive?: number
  interactiveAt?: number | null
  markAt?: number | null
  requests?: Request[]
  lcp?: number
  cls?: number
  tbt?: number
  /** The long-tasks audit's items, taken as untrusted; `null` leaves the audit out. */
  tasks?: unknown[] | null
}

/** A Lighthouse result reduced to the audits the budget reads. */
function lhr(opts: Readings = {}): unknown {
  const {
    interactive = 1000,
    interactiveAt = 300,
    markAt = 3000,
    requests = [],
    lcp = 800,
    cls = 0.001,
    tbt = 12,
    tasks = [],
  } = opts
  const marks = [
    ...(interactiveAt === null
      ? []
      : [{ name: TITLE_SCREEN_INTERACTIVE_MARK, timingType: 'Mark', startTime: interactiveAt }]),
    ...(markAt === null
      ? []
      : [{ name: WORLD_PLAYABLE_MARK, timingType: 'Mark', startTime: markAt }]),
  ]
  return {
    audits: {
      interactive: { numericValue: interactive },
      'user-timings': { details: { items: marks } },
      'network-requests': { details: { items: requests } },
      'largest-contentful-paint': { numericValue: lcp },
      'cumulative-layout-shift': { numericValue: cls },
      'total-blocking-time': { numericValue: tbt },
      ...(tasks === null ? {} : { 'long-tasks': { details: { items: tasks } } }),
    },
  }
}

function lineById(report: ReturnType<typeof evaluateBudget>, id: BudgetLineId) {
  const found = report.lines.find((l) => l.id === id)
  if (found === undefined) throw new Error(`no line ${id}`)
  return found
}

function infoById(report: ReturnType<typeof evaluateBudget>, id: InfoLineId) {
  const found = report.info.find((l) => l.id === id)
  if (found === undefined) throw new Error(`no informational line ${id}`)
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

  it('always reports the four lines in order', () => {
    const report = evaluateBudget({}, budget)
    expect(report.lines.map((l) => l.id)).toEqual([
      'title-screen-interactive',
      'world-playable',
      'download-until-playable',
      'long-task-between-marks',
    ])
  })

  it('reads Title Screen interactive from the title-screen-interactive mark, not from TTI', () => {
    const line = lineById(
      evaluateBudget(lhr({ interactiveAt: 1234.5, interactive: 2695 }), budget),
      'title-screen-interactive',
    )
    expect(line.measured).toBe(1234.5)
  })

  it('ignores a measure that carries the title-screen-interactive name', () => {
    const result = {
      audits: {
        'user-timings': {
          details: {
            items: [{ name: TITLE_SCREEN_INTERACTIVE_MARK, timingType: 'Measure', startTime: 1 }],
          },
        },
      },
    }
    expect(lineById(evaluateBudget(result, budget), 'title-screen-interactive').measured).toBeNull()
  })

  it('fails Title Screen interactive with a note when the mark is missing', () => {
    const line = lineById(
      evaluateBudget(lhr({ interactiveAt: null }), budget),
      'title-screen-interactive',
    )
    expect(line).toMatchObject({
      measured: null,
      pass: false,
      note: `mark "${TITLE_SCREEN_INTERACTIVE_MARK}" not recorded`,
    })
  })

  it('fails the run when Title Screen interactive is over its limit (gated again since T5a)', () => {
    const report = evaluateBudget(lhr({ interactiveAt: 2000.1 }), budget)
    expect(report.pass).toBe(false)
    expect(lineById(report, 'title-screen-interactive').pass).toBe(false)
  })

  it('fails the run when the title-screen-interactive mark is missing', () => {
    expect(evaluateBudget(lhr({ interactiveAt: null }), budget).pass).toBe(false)
  })

  it('gates all four lines', () => {
    const report = evaluateBudget(lhr(), budget)
    expect(report.lines.map((l) => l.gated)).toEqual([true, true, true, true])
  })

  it('passes a line that sits exactly on its limit', () => {
    expect(
      lineById(evaluateBudget(lhr({ interactiveAt: 2000 }), budget), 'title-screen-interactive')
        .pass,
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

  it('excludes requests under /media/exhibits/<id>/ (Exhibit media is outside the budget)', () => {
    const requests = [
      { transferSize: 1000, networkEndTime: 100, url: 'http://localhost:4173/assets/world-a1.js' },
      {
        transferSize: 2000,
        networkEndTime: 100,
        url: 'http://localhost:4173/media/exhibits/first/a-1440.jpg',
      },
      {
        transferSize: 4000,
        networkEndTime: 100,
        url: 'http://localhost:4173/media/exhibits/first/clip.mp4',
      },
    ]
    expect(
      lineById(evaluateBudget(lhr({ requests }), budget), 'download-until-playable').measured,
    ).toBe(1000)
  })

  it('counts images and media outside that prefix (World textures, icons, the preview image)', () => {
    const requests = [
      {
        transferSize: 1000,
        networkEndTime: 100,
        url: 'http://localhost:4173/media/site/ice.png',
        resourceType: 'Image',
      },
      {
        transferSize: 2000,
        networkEndTime: 100,
        url: 'http://localhost:4173/assets/icon.svg',
        resourceType: 'Image',
      },
      {
        transferSize: 4000,
        networkEndTime: 100,
        url: 'http://localhost:4173/media/exhibits.mp4',
        resourceType: 'Media',
      },
    ]
    expect(
      lineById(evaluateBudget(lhr({ requests }), budget), 'download-until-playable').measured,
    ).toBe(7000)
  })

  it('counts a request without a usable URL rather than dropping it', () => {
    const requests = [
      { transferSize: 1000, networkEndTime: 100 },
      { transferSize: 2000, networkEndTime: 100, url: 'not a url' },
    ]
    expect(
      lineById(evaluateBudget(lhr({ requests }), budget), 'download-until-playable').measured,
    ).toBe(3000)
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

  it('reports a missing user-timings audit as null with a note instead of throwing', () => {
    expect(lineById(evaluateBudget({}, budget), 'title-screen-interactive')).toMatchObject({
      measured: null,
      pass: false,
      note: 'audit "user-timings" is missing',
    })
  })

  it('fails the run when World playable is over its limit', () => {
    expect(evaluateBudget(lhr({ markAt: 9000 }), budget).pass).toBe(false)
  })

  it('fails the run when the download line is over its limit', () => {
    const requests = [{ transferSize: 4097, networkEndTime: 100 }]
    expect(evaluateBudget(lhr({ requests }), budget).pass).toBe(false)
  })

  // Line 1's condition (b), plan §7: no long task ≥ the limit with a start time between the marks.
  describe('the long task between the marks', () => {
    const between = (tasks: Task[]) =>
      lineById(
        evaluateBudget(lhr({ interactiveAt: 300, markAt: 3000, tasks }), budget),
        'long-task-between-marks',
      )

    it('measures the longest task that starts between the two marks', () => {
      const line = between([
        { startTime: 400, duration: 60 },
        { startTime: 1100, duration: 65.3 },
        { startTime: 2000, duration: 52 },
      ])
      expect(line).toMatchObject({ measured: 65.3, limit: 100, pass: true })
    })

    it('ignores a task that starts before the first mark or after the second', () => {
      const line = between([
        { startTime: 100, duration: 900 },
        { startTime: 3000.1, duration: 500 },
        { startTime: 1000, duration: 55 },
      ])
      expect(line.measured).toBe(55)
    })

    it('counts a task that starts exactly on a mark', () => {
      expect(between([{ startTime: 300, duration: 70 }]).measured).toBe(70)
      expect(between([{ startTime: 3000, duration: 80 }]).measured).toBe(80)
    })

    it('reads 0 and passes when no long task starts between the marks', () => {
      expect(between([])).toMatchObject({ measured: 0, pass: true })
    })

    it('fails a task at the limit: "no long task ≥ the limit" (ADR 0010)', () => {
      expect(between([{ startTime: 1000, duration: 100 }]).pass).toBe(false)
      expect(between([{ startTime: 1000, duration: 99.9 }]).pass).toBe(true)
    })

    it('fails the run on a breach', () => {
      const report = evaluateBudget(
        lhr({ interactiveAt: 300, markAt: 3000, tasks: [{ startTime: 1000, duration: 250 }] }),
        budget,
      )
      expect(report.pass).toBe(false)
    })

    it('cannot be measured without the long-tasks audit', () => {
      const line = lineById(evaluateBudget(lhr({ tasks: null }), budget), 'long-task-between-marks')
      expect(line).toMatchObject({
        measured: null,
        pass: false,
        note: 'audit "long-tasks" is missing',
      })
    })

    it('cannot be measured without either mark', () => {
      expect(
        lineById(evaluateBudget(lhr({ interactiveAt: null }), budget), 'long-task-between-marks'),
      ).toMatchObject({ measured: null, note: 'needs the title-screen-interactive mark' })
      expect(
        lineById(evaluateBudget(lhr({ markAt: null }), budget), 'long-task-between-marks'),
      ).toMatchObject({ measured: null, note: 'needs the world-playable mark' })
    })

    it('skips an item without numeric times', () => {
      const line = lineById(
        evaluateBudget(
          lhr({
            interactiveAt: 300,
            markAt: 3000,
            tasks: [{ startTime: 1000, duration: 55 }, { startTime: 1200 }],
          }),
          budget,
        ),
        'long-task-between-marks',
      )
      expect(line.measured).toBe(55)
    })
  })

  it('reports TTI, LCP, CLS and TBT as informational lines, in that order', () => {
    const report = evaluateBudget(lhr({ interactive: 2695, lcp: 800, cls: 0.001, tbt: 12 }), budget)
    expect(report.info.map((l) => [l.id, l.measured])).toEqual([
      ['tti', 2695],
      ['lcp', 800],
      ['cls', 0.001],
      ['tbt', 12],
    ])
  })

  it('never fails the run on an informational line', () => {
    expect(evaluateBudget(lhr({ interactive: 9999, tbt: 5000 }), budget).pass).toBe(true)
  })

  it('reports an informational line without a value as null with a note', () => {
    const result = { audits: { 'user-timings': { details: { items: [] } } } }
    expect(infoById(evaluateBudget(result, budget), 'lcp')).toMatchObject({
      measured: null,
      note: 'audit "largest-contentful-paint" has no numericValue',
    })
  })
})

describe('diagnose', () => {
  it('reports nothing for a result without errors or warnings', () => {
    expect(diagnose(lhr())).toEqual({ runtimeError: null, warnings: [], auditErrors: [] })
  })

  it('reports the runtime error with its code', () => {
    const result = { runtimeError: { code: 'NO_FCP', message: 'The page did not paint' } }
    expect(diagnose(result).runtimeError).toBe('NO_FCP: The page did not paint')
  })

  it('reports a runtime error without a code by its message alone', () => {
    expect(diagnose({ runtimeError: { message: 'hung' } }).runtimeError).toBe('hung')
  })

  it('reports the run warnings and the audit errors of every audit the run asks for', () => {
    const result = {
      runWarnings: ['The page loaded too slowly', 7],
      audits: {
        interactive: { errorMessage: 'Required trace gatherer did not run' },
        'user-timings': { numericValue: 1 },
        'total-blocking-time': { errorMessage: 'no trace' },
        'long-tasks': { errorMessage: 'no tasks' },
      },
    }
    expect(diagnose(result)).toEqual({
      runtimeError: null,
      warnings: ['The page loaded too slowly'],
      auditErrors: [
        'audit "interactive": Required trace gatherer did not run',
        'audit "total-blocking-time": no trace',
        'audit "long-tasks": no tasks',
      ],
    })
  })

  it('tolerates a result that is not an object', () => {
    expect(diagnose(undefined)).toEqual({ runtimeError: null, warnings: [], auditErrors: [] })
  })
})

describe('formatDiagnostics', () => {
  it('prints one line per diagnostic', () => {
    expect(
      formatDiagnostics({
        runtimeError: 'NO_FCP: no paint',
        warnings: ['slow'],
        auditErrors: ['audit "interactive": no trace'],
      }),
    ).toEqual([
      '  runtimeError: NO_FCP: no paint',
      '  runWarning: slow',
      '  audit "interactive": no trace',
    ])
  })

  it('says so when Lighthouse reported nothing', () => {
    expect(formatDiagnostics(diagnose({}))).toEqual([
      '  no runtimeError, no runWarnings, no audit error reported',
    ])
  })
})

describe('failedReport', () => {
  it('fails all four lines with the given note', () => {
    const report = failedReport(budget, 'error: Chrome did not start')
    expect(report.lines.map((l) => [l.measured, l.pass, l.note])).toEqual([
      [null, false, 'error: Chrome did not start'],
      [null, false, 'error: Chrome did not start'],
      [null, false, 'error: Chrome did not start'],
      [null, false, 'error: Chrome did not start'],
    ])
  })

  it('carries the informational lines without a value and with the same note', () => {
    const report = failedReport(budget, 'error: Chrome did not start')
    expect(report.info.map((l) => [l.id, l.measured, l.note])).toEqual([
      ['tti', null, 'error: Chrome did not start'],
      ['lcp', null, 'error: Chrome did not start'],
      ['cls', null, 'error: Chrome did not start'],
      ['tbt', null, 'error: Chrome did not start'],
    ])
  })
})

describe('formatReport', () => {
  it('prints measured, limit and verdict for a passing gated line', () => {
    const [, playable] = formatReport(evaluateBudget(lhr({ markAt: 1234.4 }), budget))
    expect(playable).toMatch(/World playable\s+1234 ms\s+limit 5000 ms\s+pass$/)
  })

  it('prints FAIL for a gated line over its limit', () => {
    const [, playable] = formatReport(evaluateBudget(lhr({ markAt: 5001 }), budget))
    expect(playable).toMatch(/World playable\s+5001 ms\s+limit 5000 ms\s+FAIL$/)
  })

  it('prints FAIL, never "over" or an informational tag, for Title Screen interactive over its limit', () => {
    const [first] = formatReport(evaluateBudget(lhr({ interactiveAt: 2695 }), budget))
    expect(first).toMatch(/Title Screen interactive\s+2695 ms\s+limit 2000 ms\s+FAIL$/)
    expect(first).not.toContain('informational')
  })

  it('prints over or n/a with an informational tag, never FAIL, should a line be ungated again', () => {
    const report = evaluateBudget(lhr({ interactiveAt: 2695 }), budget)
    const [first] = report.lines
    if (first === undefined) throw new Error('no line')
    const over = formatReport({ ...report, lines: [{ ...first, gated: false }] })
    expect(over[0]).toMatch(
      /Title Screen interactive\s+2695 ms\s+limit 2000 ms\s+over\s+informational$/,
    )
    const none = formatReport({
      ...report,
      lines: [{ ...first, gated: false, measured: null, pass: false }],
    })
    expect(none[0]).toMatch(/limit 2000 ms\s+n\/a\s+informational$/)
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

  it('prints the long-task line fourth, with its limit as a bound the value must stay under', () => {
    const [, , , longTask] = formatReport(
      evaluateBudget(lhr({ tasks: [{ startTime: 1000, duration: 65.3 }] }), budget),
    )
    expect(longTask).toMatch(/Longest task between marks\s+65 ms\s+limit < 100 ms\s+pass$/)
    const [, , , breached] = formatReport(
      evaluateBudget(lhr({ tasks: [{ startTime: 1000, duration: 100 }] }), budget),
    )
    expect(breached).toMatch(/Longest task between marks\s+100 ms\s+limit < 100 ms\s+FAIL$/)
  })

  it('prints the informational lines after the four budget lines, with no limit and no verdict', () => {
    const lines = formatReport(
      evaluateBudget(lhr({ interactive: 2695.4, lcp: 812.6, cls: 0.0012, tbt: 12.4 }), budget),
    )
    expect(lines).toHaveLength(8)
    expect(lines[4]).toMatch(/^ {2}TTI \(informational\)\s+2695 ms$/)
    expect(lines[5]).toMatch(/^ {2}LCP \(informational\)\s+813 ms$/)
    expect(lines[6]).toMatch(/^ {2}CLS \(informational\)\s+0\.001$/)
    expect(lines[7]).toMatch(/^ {2}TBT \(informational\)\s+12 ms$/)
  })

  it('prints n/a with the note for an informational line without a value', () => {
    const lines = formatReport(evaluateBudget({}, budget))
    expect(lines[4]).toMatch(
      /TTI \(informational\)\s+n\/a \(audit "interactive" has no numericValue\)$/,
    )
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

  it('rejects a file without the long-task limit (T5b: plan §7 line 1, condition b)', () => {
    const limits: Partial<typeof budget.limits> = { ...budget.limits }
    delete limits.longTaskBetweenMarksMs
    expect(() => parseBudget({ ...raw, limits })).toThrow(
      /"limits.longTaskBetweenMarksMs" must be a non-negative number/,
    )
  })

  it('rejects a limit that is not a non-negative number', () => {
    const broken = { ...raw, limits: { ...budget.limits, worldPlayableMs: '5000' } }
    expect(() => parseBudget(broken)).toThrow(
      /"limits.worldPlayableMs" must be a non-negative number/,
    )
  })
})
