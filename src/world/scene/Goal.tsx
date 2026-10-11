// The Goal as the model lays it out: the net's solid frame from the same boxes as its colliders,
// a translucent body over the sensor volume so the net reads as a net, and the goal line painted
// across the Zone. Nothing here senses anything; the model does (ADR 0009).
import type { Goal as GoalLayout, Rect } from '../model/layout'
import { BOARD, rectBox } from '../model/world'
import { IceLine, Solid } from './Solid'

const FRAME_COLOUR = '#c8102e'
const NET_COLOUR = '#ffffff'
const NET_OPACITY = 0.35

export function Goal({ goal, rink }: { goal: GoalLayout; rink: Rect }) {
  return (
    <group>
      {goal.posts.map((post, i) => (
        <Solid key={i} box={rectBox(post, BOARD.height)} colour={FRAME_COLOUR} />
      ))}
      <Solid box={rectBox(goal.sensor, BOARD.height)} colour={NET_COLOUR} opacity={NET_OPACITY} />
      <IceLine x={rink.centre.x} z={goal.line.a.z} width={rink.width} colour={FRAME_COLOUR} />
    </group>
  )
}
