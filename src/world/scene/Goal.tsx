// The Goal as the model lays it out: the net's solid frame from the same boxes as its colliders,
// a translucent body filling the net from the goal line to its back so it reads as a net (the
// sensor itself starts a Puck radius behind the line and is not drawn), the goal line painted
// across the Zone as on a rink (the layout's `goal.line` is its part between the posts, the one
// that counts). Nothing here senses anything; the model does (ADR 0009).
import { useMemo } from 'react'

import type { Goal as GoalLayout, Rect, Zone } from '../model/layout'
import { BOARD, frameBoxes, rectBox } from '../model/world'
import { RED } from './colours'
import { IceLine, Solid } from './Solid'

const NET_COLOUR = '#ffffff'
const NET_OPACITY = 0.35

/** The net's cavity: from the goal line to the back, as wide as the mouth. */
function netCavity(goal: GoalLayout): Rect {
  const lineZ = goal.line.a.z
  const back = goal.sensor.centre.z - goal.sensor.length / 2
  return {
    centre: { x: goal.sensor.centre.x, z: (lineZ + back) / 2 },
    width: goal.sensor.width,
    length: lineZ - back,
  }
}

export function Goal({ zone }: { zone: Zone }) {
  const { goal, rect } = zone
  const geometry = useMemo(
    () => ({ frame: frameBoxes(goal), net: rectBox(netCavity(goal), BOARD.height) }),
    [goal],
  )
  return (
    <group>
      {geometry.frame.map((box, i) => (
        <Solid key={i} box={box} colour={RED} />
      ))}
      <Solid box={geometry.net} colour={NET_COLOUR} opacity={NET_OPACITY} />
      <IceLine x={rect.centre.x} z={goal.line.a.z} width={rect.width} colour={RED} />
    </group>
  )
}
