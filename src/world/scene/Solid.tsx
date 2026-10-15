// The scene's two primitives: a solid box (boards, the net's frame and body) drawn from the same
// box the model's collider uses, and a line painted on the ice. No texture, nothing fetched.
import type { Box } from '../model/world'
import { LINE_HEIGHT } from './marking'

const LINE_WIDTH = 0.3

export function Solid({
  box,
  colour,
  opacity = 1,
}: {
  box: Box
  colour: string
  opacity?: number
}) {
  return (
    <mesh position={[box.centre.x, box.centre.y, box.centre.z]}>
      <boxGeometry args={[box.size.x, box.size.y, box.size.z]} />
      <meshStandardMaterial color={colour} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

/** A line across the ice along x, `width` long, centred on (x, z). */
export function IceLine({
  x,
  z,
  width,
  colour,
}: {
  x: number
  z: number
  width: number
  colour: string
}) {
  return (
    <mesh position={[x, LINE_HEIGHT / 2, z]}>
      <boxGeometry args={[width, LINE_HEIGHT, LINE_WIDTH]} />
      <meshStandardMaterial color={colour} />
    </mesh>
  )
}
