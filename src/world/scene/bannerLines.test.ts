import { describe, expect, it } from 'vitest'

import { loadContentFromDisk } from '../../../build/content-plugin'
import { BANNER_TYPE, bannerLines, type Measure } from './bannerLines'

// AC-13.2: the Banner's text equals the Exhibit's title and hook, the title on one line and the hook
// on one or two lines. A fake measure, half the font size per character (bold a little wider), so
// widths are exact; the real canvas measures the same way, linearly in the size.
const measure: Measure = (text, weight, px) => text.length * px * (weight === 'bold' ? 0.55 : 0.5)
const ROOM = { width: 1856, height: 686 }

const SHORT = { title: 'Exhibit 1', hook: 'A short hook' }
const LONG_HOOK = 'A hockey puck, a rink, and a repo where every decision has a paper trail.'

function widthOf(line: { text: string; px: number }, weight: 'bold' | 'normal'): number {
  return measure(line.text, weight, line.px)
}

describe('bannerLines: every word of the content (AC-13.2)', () => {
  it('draws the title exactly as written', () => {
    expect(bannerLines({ title: 'Exhibit 1', hook: LONG_HOOK }, measure, ROOM).title.text).toBe(
      'Exhibit 1',
    )
  })

  it.each([SHORT.hook, LONG_HOOK, `${LONG_HOOK} ${LONG_HOOK}`])(
    'draws the hook exactly as written across its lines: %s',
    (hook) => {
      const lines = bannerLines({ title: 'T', hook }, measure, ROOM).hook
      expect(lines.map((line) => line.text).join(' ')).toBe(hook)
    },
  )

  it("draws the real Exhibit's title and hook", async () => {
    const [exhibit] = (await loadContentFromDisk()).exhibits
    expect(exhibit).toBeDefined()
    const words = { title: exhibit?.title ?? '', hook: exhibit?.hook ?? '' }
    const lines = bannerLines(words, measure, ROOM)
    expect([lines.title.text, lines.hook.map((line) => line.text).join(' ')]).toEqual([
      words.title,
      words.hook,
    ])
  })
})

describe('bannerLines: the title on one line', () => {
  it('keeps a short title at its largest size', () => {
    expect(bannerLines(SHORT, measure, ROOM).title.px).toBe(
      Math.round(ROOM.height * BANNER_TYPE.title),
    )
  })

  it('shrinks a title too wide for the room so its one line fits', () => {
    const title = 'This portfolio, built the way I would build it at work'
    const line = bannerLines({ title, hook: 'h' }, measure, ROOM).title
    expect(widthOf(line, 'bold')).toBeLessThanOrEqual(ROOM.width)
  })
})

describe('bannerLines: the hook on one or two lines', () => {
  it('keeps a hook that fits on one line', () => {
    expect(bannerLines(SHORT, measure, ROOM).hook).toHaveLength(1)
  })

  it('breaks a hook too wide for one line into two lines that fit', () => {
    const lines = bannerLines({ title: 'T', hook: LONG_HOOK }, measure, ROOM).hook
    expect([lines.length, ...lines.map((line) => widthOf(line, 'normal') <= ROOM.width)]).toEqual([
      2,
      true,
      true,
    ])
  })

  it('balances the two lines: the break makes the longer one shortest', () => {
    const narrow = { width: 400, height: ROOM.height }
    const hook = 'aaaa bb cc dd ee'
    const [first, second] = bannerLines({ title: 'T', hook }, measure, narrow).hook
    expect([first.text, second?.text]).toEqual(['aaaa bb', 'cc dd ee'])
  })

  it('shrinks a hook too long for two lines at its largest size, still two lines', () => {
    const hook = `${LONG_HOOK} ${LONG_HOOK} ${LONG_HOOK}`
    const lines = bannerLines({ title: 'T', hook }, measure, ROOM).hook
    expect([lines.length, ...lines.map((line) => widthOf(line, 'normal') <= ROOM.width)]).toEqual([
      2,
      true,
      true,
    ])
  })

  it('shrinks a hook with no space to break at on its one line', () => {
    const lines = bannerLines({ title: 'T', hook: 'x'.repeat(200) }, measure, ROOM).hook
    expect([lines.length, widthOf(lines[0], 'normal') <= ROOM.width]).toEqual([1, true])
  })
})

describe('bannerLines: the block on the canvas', () => {
  it('stacks title and hook lines top to bottom inside the room', () => {
    const lines = bannerLines({ title: 'T', hook: LONG_HOOK }, measure, ROOM)
    const ys = [lines.title, ...lines.hook].map((line) => line.y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })

  it('shrinks every line when the stack is taller than the room', () => {
    const flat = { width: ROOM.width, height: 200 }
    const type = { title: 0.6, hook: 0.6, leading: 1.15, stretch: 2 }
    const lines = bannerLines({ title: 'T', hook: 'h h' }, measure, flat, type)
    const height = 1.15 * 2 * (lines.title.px + lines.hook.reduce((sum, l) => sum + l.px, 0))
    expect(height).toBeLessThanOrEqual(flat.height)
  })
})
