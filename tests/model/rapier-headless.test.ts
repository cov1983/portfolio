import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

// Spec seam 2 (docs/spec/increment-1.md, Testing decisions): the World's model stepped under Node
// with Rapier, no renderer and no GPU. Phase 0b only proves the seam: Rapier initialises under
// Node and a fixed number of fixed timesteps gives a deterministic result. increment-1 tickets
// replace the ball with the Puck on its Rink.
const GROUND_HALF_EXTENTS = { x: 10, y: 0.1, z: 10 }
const BALL_RADIUS = 0.5
const DROP_HEIGHT = 3
const STEPS = 240 // 4 s at Rapier's default timestep of 1/60 s

let world: RAPIER.World | undefined

function dropBallOntoGround(): RAPIER.RigidBody {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      GROUND_HALF_EXTENTS.x,
      GROUND_HALF_EXTENTS.y,
      GROUND_HALF_EXTENTS.z,
    ).setTranslation(0, -GROUND_HALF_EXTENTS.y, 0),
  )
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, DROP_HEIGHT, 0),
  )
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS), ball)
  for (let step = 0; step < STEPS; step += 1) {
    world.step()
  }
  return ball
}

beforeAll(async () => {
  // 0.19.2 prints "using deprecated parameters for the initialization function" from inside
  // its own init(); the package calls wasm-bindgen with positional arguments. Harmless.
  await RAPIER.init()
})

afterEach(() => {
  world?.free()
  world = undefined
})

describe('Rapier stepped headless under Node', () => {
  it('a ball dropped onto the ground comes to rest on it', () => {
    const ball = dropBallOntoGround()
    expect(ball.translation().y).toBeCloseTo(BALL_RADIUS, 1)
  })

  it('a ball dropped onto the ground stops moving', () => {
    const ball = dropBallOntoGround()
    const { x, y, z } = ball.linvel()
    expect(Math.hypot(x, y, z)).toBeLessThan(0.01)
  })
})
