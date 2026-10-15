import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { worldLayout } from '../model/layout'
import { exhibitIdSchema } from '../../content/schema'
import { markingRotation } from './marking'

// AC-13.2, "upright for a Visitor looking from the Hub side": the Banner's plane is drawn with its
// text's top along its local +y and faces +z; laid on the ice it must face up and point the top of
// its text along the layout's `up`, away from the Hub.
const zone = worldLayout({
  id: exhibitIdSchema.parse('exhibit-1'),
  title: 'Exhibit 1',
  hook: 'A fixture',
}).zones[0]
if (zone === undefined) throw new Error('the one-Zone layout has no Zone')

/** The vector's components to 1e-9, with −0 as 0, so equal directions compare equal. */
function rounded(v: Vector3): [number, number, number] {
  const r = (c: number) => Math.round(c * 1e9) / 1e9 + 0
  return [r(v.x), r(v.y), r(v.z)]
}

describe('markingRotation', () => {
  it("points the top of the Banner's text along its up, away from the Hub", () => {
    const top = new Vector3(0, 1, 0).applyEuler(markingRotation(zone.banner.up))
    expect(rounded(top)).toEqual([zone.banner.up.x, 0, zone.banner.up.z])
  })

  it('lays the Banner flat on the ice, facing up', () => {
    const normal = new Vector3(0, 0, 1).applyEuler(markingRotation(zone.banner.up))
    expect(rounded(normal)).toEqual([0, 1, 0])
  })

  it('turns the text with any direction on the ice', () => {
    const up = { x: Math.SQRT1_2, z: Math.SQRT1_2 }
    const top = new Vector3(0, 1, 0).applyEuler(markingRotation(up))
    expect(rounded(top)).toEqual(rounded(new Vector3(up.x, 0, up.z)))
  })
})
