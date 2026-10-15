import { describe, expect, it } from 'vitest'

import { exhibitIdSchema } from '../../content/schema'
import { worldLayout } from '../model/layout'
import { iceUv, TILE } from './ice'

// The ice texture lies in world space: where two slabs meet, their edges get the same texture
// coordinate, so Hub, Path and Zone read as one continuous ice (#55).
const layout = worldLayout({ id: exhibitIdSchema.parse('exhibit-1'), title: 'T', hook: 'H' })
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the one-Zone layout has no Zone')

/** v of the far and of the near edge: indexes 1 and 5 of the plane's UVs. */
function edges(uv: number[]): { far: number | undefined; near: number | undefined } {
  return { far: uv[1], near: uv[5] }
}

describe('iceUv', () => {
  it("gives the Hub's far edge and the Path's near edge the same v", () => {
    expect(edges(iceUv(layout.hub.rect)).far).toBeCloseTo(
      edges(iceUv(layout.path.rect)).near ?? Number.NaN,
      9,
    )
  })

  it("gives the Path's far edge and the Zone's near edge the same v", () => {
    expect(edges(iceUv(layout.path.rect)).far).toBeCloseTo(
      edges(iceUv(zone.rect)).near ?? Number.NaN,
      9,
    )
  })

  it('gives the same x the same u on every slab', () => {
    const path = layout.path.rect
    const atLeft = (path.centre.x - path.width / 2) / TILE.width
    expect(iceUv(path)[0]).toBeCloseTo(atLeft, 9)
  })

  it('repeats the tile once per tile size of ice', () => {
    const uv = iceUv({ centre: { x: 0, z: 0 }, width: TILE.width * 2, length: TILE.length * 3 })
    expect([(uv[2] ?? 0) - (uv[0] ?? 0), (uv[1] ?? 0) - (uv[5] ?? 0)]).toEqual([2, 3])
  })
})
