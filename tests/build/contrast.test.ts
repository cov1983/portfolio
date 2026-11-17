import { describe, expect, it } from 'vitest'

import { contrast, over, parseHex } from './contrast'

// The evaluator behind tokens.test.ts's glow case, against values WCAG and the token layer's own
// recorded ratios fix.
describe('contrast', () => {
  it('reads #rrggbbaa as channels and alpha', () => {
    expect(parseHex('#168bff59')).toEqual({ rgb: [22, 139, 255], alpha: 0x59 / 255 })
  })

  it('rejects a colour that is not hex', () => {
    expect(() => parseHex('rgb(0 0 0)')).toThrow('not a #rrggbb or #rrggbbaa colour')
  })

  it('composites a translucent colour over an opaque one', () => {
    expect(over('#ffffff80', '#000000').map(Math.round)).toEqual([128, 128, 128])
  })

  it('gives 21:1 for white on black, in either order', () => {
    expect(contrast([255, 255, 255], [0, 0, 0])).toBe(21)
    expect(contrast([0, 0, 0], [255, 255, 255])).toBe(21)
  })

  // tokens.css records navy ink on the accent at 5.6:1 (and white at 3.4:1).
  it('matches the ratios tokens.css records for the filled control', () => {
    const accent = parseHex('#168bff').rgb
    expect(contrast(parseHex('#080f1d').rgb, accent)).toBeCloseTo(5.6, 1)
    expect(contrast(parseHex('#ffffff').rgb, accent)).toBeCloseTo(3.4, 1)
  })
})
