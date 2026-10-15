import { describe, expect, it } from 'vitest'

import { contrastRatio, ICE_COLOUR, INK, relativeLuminance } from './colours'

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 9)
  })

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio(ICE_COLOUR, INK)).toBe(contrastRatio(INK, ICE_COLOUR))
  })

  it('reads 8-bit channels as the same colour as their hex', () => {
    expect(relativeLuminance([0x0b, 0x1a, 0x2a])).toBe(relativeLuminance(INK))
  })

  it('rejects a colour that is not #rrggbb', () => {
    expect(() => relativeLuminance('#fff')).toThrow('not a #rrggbb colour: #fff')
  })
})

describe("The Banner's ink on the ice (Q4 on #55)", () => {
  it('has a contrast of at least 7:1 against the ice colour', () => {
    expect(contrastRatio(INK, ICE_COLOUR)).toBeGreaterThanOrEqual(7)
  })
})
