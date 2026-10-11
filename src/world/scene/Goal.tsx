// The Goal as the model lays it out: the net's solid frame from the same boxes as its colliders,
// a translucent body over the sensor volume so the net reads as a net, the goal line painted
// across the Zone as on a rink (the layout's `goal.line` is its part between the posts, the one
// that counts), and the Banner hanging over the net. Nothing here senses anything; the model does
// (ADR 0009).
import type { Goal as GoalLayout, Rect } from '../model/layout'
import { BOARD, frameBoxes, rectBox } from '../model/world'
import { Banner } from './Banner'
import { IceLine, Solid } from './Solid'

const FRAME_COLOUR = '#c8102e'
const NET_COLOUR = '#ffffff'
const NET_OPACITY = 0.35
/** The Banner hangs this high above the ice, this far behind the goal line. */
const BANNER = { height: 3, behindLine: 1 }

export function Goal({ goal, rink, banner }: { goal: GoalLayout; rink: Rect; banner: string }) {
  return (
    <group>
      {frameBoxes(goal).map((box, i) => (
        <Solid key={i} box={box} colour={FRAME_COLOUR} />
      ))}
      <Solid box={rectBox(goal.sensor, BOARD.height)} colour={NET_COLOUR} opacity={NET_OPACITY} />
      <IceLine x={rink.centre.x} z={goal.line.a.z} width={rink.width} colour={FRAME_COLOUR} />
      <Banner
        text={banner}
        position={{
          x: goal.sensor.centre.x,
          y: BANNER.height,
          z: goal.line.a.z - BANNER.behindLine,
        }}
      />
    </group>
  )
}
