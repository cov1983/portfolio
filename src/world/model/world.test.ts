import { describe, expect, it } from 'vitest'

import { BOARD, boardBox, driveVector } from './world'

// The pure parts of the model; the Rapier-backed behaviour is seam 2 (tests/model).
describe('driveVector', () => {
  it('is null when nothing is pressed', () => {
    expect(driveVector({ up: false, down: false, left: false, right: false })).toBeNull()
  })

  it('points up along negative z', () => {
    expect(driveVector({ up: true, down: false, left: false, right: false })).toEqual({
      x: 0,
      z: -1,
    })
  })

  it('normalises a diagonal to unit length (AC-7.3)', () => {
    const v = driveVector({ up: true, down: false, left: false, right: true })
    expect(Math.hypot(v?.x ?? 0, v?.z ?? 0)).toBeCloseTo(1, 12)
  })

  it('cancels opposite keys', () => {
    expect(driveVector({ up: true, down: true, left: false, right: false })).toBeNull()
  })
})

describe('boardBox', () => {
  const rect = { centre: { x: 0, z: 0 }, length: 40, width: 20 }

  it('places a board along x just outside the far edge, standing on the ice', () => {
    const box = boardBox({ a: { x: -10, z: -20 }, b: { x: 10, z: -20 } }, rect)
    expect(box).toEqual({
      centre: { x: 0, y: BOARD.height / 2, z: -20 - BOARD.thickness / 2 },
      size: { x: 20 + 2 * BOARD.thickness, y: BOARD.height, z: BOARD.thickness },
    })
  })

  it('places a board along z just outside the right edge', () => {
    const box = boardBox({ a: { x: 10, z: -20 }, b: { x: 10, z: 20 } }, rect)
    expect(box).toEqual({
      centre: { x: 10 + BOARD.thickness / 2, y: BOARD.height / 2, z: 0 },
      size: { x: BOARD.thickness, y: BOARD.height, z: 40 + 2 * BOARD.thickness },
    })
  })

  it('refuses a board that is not axis-aligned', () => {
    expect(() => boardBox({ a: { x: 0, z: 0 }, b: { x: 1, z: 1 } }, rect)).toThrow(/axis-aligned/)
  })
})
