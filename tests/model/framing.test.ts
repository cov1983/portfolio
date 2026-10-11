import { describe, expect, it } from 'vitest'

import {
  cameraFollow,
  cameraGoal,
  framesPoint,
  type CameraPose,
} from '../../src/world/model/camera'
import {
  rectEdges,
  worldLayout,
  type Rect,
  type Vec2,
  type Vec3,
} from '../../src/world/model/layout'
import { FIXED_DT, PUCK, STANDARD } from '../../src/world/model/world'
import { PLACEHOLDER_EXHIBIT, seededRandom } from './helpers'

// Spec seam 2, the Follow Camera over the whole World, pure: AC-5.2 (the first frame from the
// Reset point holds the Hub's Path opening) and AC-11.2 (the Puck is inside the frame wherever it
// is, both at the camera's goal pose and at the eased pose it lags behind at top speed, which is
// the frame the Visitor sees). Four aspect ratios from ultra-wide to 4:3.
const ASPECTS = [21 / 9, 16 / 9, 3 / 2, 4 / 3]
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the placeholder layout has no Zone')
const rects: Rect[] = [layout.hub.rect, layout.path.rect, zone.rect]

function onIce(point: Vec2): Vec3 {
  return { x: point.x, y: 0, z: point.z }
}

function puckAt(point: Vec2): Vec3 {
  return { x: point.x, y: PUCK.height / 2, z: point.z }
}

describe('The first frame holds the Path opening (AC-5.2)', () => {
  const pose = cameraGoal(layout.hub.resetPoint)
  // The Path's near edge is the opening in the Hub's far boards.
  const [opening] = rectEdges(layout.path.rect)
  const points = [opening.a, { x: (opening.a.x + opening.b.x) / 2, z: opening.a.z }, opening.b]

  it.each(ASPECTS)('frames both ends and the middle of the opening at aspect %f', (aspect) => {
    expect(points.map((p) => framesPoint(pose, onIce(p), aspect))).toEqual([true, true, true])
  })
})

describe('The Puck is inside the frame anywhere in the World (AC-11.2)', () => {
  it.each(ASPECTS)('at the goal pose, for 200 sampled positions, at aspect %f', (aspect) => {
    const random = seededRandom(11)
    const unframed: Vec2[] = []
    for (let i = 0; i < 200; i += 1) {
      const rect = rects[i % rects.length] ?? layout.hub.rect
      const point = {
        x: rect.centre.x + (random() - 0.5) * rect.width,
        z: rect.centre.z + (random() - 0.5) * rect.length,
      }
      if (!framesPoint(cameraGoal(point), puckAt(point), aspect)) unframed.push(point)
    }
    expect(unframed).toEqual([])
  })

  it.each(ASPECTS)(
    'at the eased pose while sprinting in eight directions, at aspect %f',
    (aspect) => {
      const unframed: { direction: number; step: number }[] = []
      for (let direction = 0; direction < 8; direction += 1) {
        const angle = (direction * Math.PI) / 4
        const velocity = {
          x: Math.cos(angle) * STANDARD.maxSpeed,
          z: Math.sin(angle) * STANDARD.maxSpeed,
        }
        let point = { ...layout.hub.resetPoint }
        let pose: CameraPose = cameraGoal(point)
        for (let step = 1; step <= 120; step += 1) {
          point = { x: point.x + velocity.x * FIXED_DT, z: point.z + velocity.z * FIXED_DT }
          pose = cameraFollow(pose, cameraGoal(point), FIXED_DT, false)
          if (!framesPoint(pose, puckAt(point), aspect)) unframed.push({ direction, step })
        }
      }
      expect(unframed).toEqual([])
    },
  )
})
