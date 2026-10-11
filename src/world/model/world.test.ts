import { describe, expect, it } from 'vitest'

import { hubLayout, PLACEHOLDER_EXHIBIT, rectEdges, worldLayout } from './layout'
import { BOARD, boardBox, boardBoxes, driveVector, NO_INPUT, rectBox } from './world'

// The pure parts of the model; the Rapier-backed behaviour is seam 2 (tests/model).
describe('driveVector', () => {
  it('is null when nothing is pressed', () => {
    expect(driveVector(NO_INPUT)).toBeNull()
  })

  it('points up along negative z', () => {
    expect(driveVector({ ...NO_INPUT, up: true })).toEqual({
      x: 0,
      z: -1,
    })
  })

  it('normalises a diagonal to unit length (AC-7.3)', () => {
    const v = driveVector({ ...NO_INPUT, up: true, right: true })
    expect(Math.hypot(v?.x ?? 0, v?.z ?? 0)).toBeCloseTo(1, 12)
  })

  it('cancels opposite keys', () => {
    expect(driveVector({ ...NO_INPUT, up: true, down: true })).toBeNull()
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

  it('runs past one end only when told so', () => {
    const box = boardBox({ a: { x: -10, z: -20 }, b: { x: -3, z: -20 } }, rect, {
      a: true,
      b: false,
    })
    expect(box.centre.x).toBeCloseTo((-10 - BOARD.thickness - 3) / 2, 9)
    expect(box.size.x).toBeCloseTo(7 + BOARD.thickness, 9)
  })

  it('refuses a board that is not axis-aligned', () => {
    expect(() => boardBox({ a: { x: 0, z: 0 }, b: { x: 1, z: 1 } }, rect)).toThrow(/axis-aligned/)
  })
})

describe('rectBox', () => {
  it('stands a rect on the ice as a box of the given height', () => {
    expect(rectBox({ centre: { x: 1, z: -2 }, width: 0.3, length: 2 }, 1.2)).toEqual({
      centre: { x: 1, y: 0.6, z: -2 },
      size: { x: 0.3, y: 1.2, z: 2 },
    })
  })
})

describe('boardBoxes', () => {
  const boxes = boardBoxes(worldLayout(PLACEHOLDER_EXHIBIT))
  const t = BOARD.thickness

  it('equals the four extended boards of the closed Hub', () => {
    const { rect } = hubLayout().hub
    expect(boardBoxes(hubLayout())).toEqual(rectEdges(rect).map((edge) => boardBox(edge, rect)))
  })

  it('makes one box per board of the Hub, the Path and the Zone', () => {
    expect(boxes).toHaveLength(12)
  })

  it('stops the Hub far pieces at the opening: no lip into the mouth', () => {
    const farLeft = boxes.find((b) => b.centre.z < -20 && b.centre.z > -21 && b.centre.x < 0)
    expect(farLeft?.centre.x).toBeCloseTo((-10 - t - 3) / 2, 9)
    expect(farLeft?.size.x).toBeCloseTo(7 + t, 9)
  })

  it('stops the Path side boards at both ends: no stub into the Hub or the Zone', () => {
    const left = boxes.find((b) => b.centre.x < -3 && b.centre.x > -4 && b.centre.z === -27.5)
    expect(left?.size.z).toBe(15)
  })

  it('runs the Hub side boards past both outer corners, sealing them', () => {
    const left = boxes.find((b) => b.centre.x < -10 && b.centre.z === 0)
    expect(left?.size.z).toBeCloseTo(40 + 2 * t, 9)
  })

  it('runs the Zone near pieces past the outer corner only', () => {
    const nearRight = boxes.find((b) => b.centre.z > -35 && b.centre.z < -34 && b.centre.x > 0)
    expect(nearRight?.centre.x).toBeCloseTo((3 + 10 + t) / 2, 9)
    expect(nearRight?.size.x).toBeCloseTo(7 + t, 9)
  })
})
