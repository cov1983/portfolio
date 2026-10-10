// PROTOTYPE (chore/prototype-q1-q4, throwaway): the `world` chunk, split variant for Q1. three +
// React Three Fiber in this chunk; Rapier is a second dynamic import started in the mount, so its
// chunk evaluates (and, for the wasm package, compiles) only when the World mounts.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { markWorldPlayable } from '../perf/world-playable'

function Scene() {
  // A ref, not state: invalidate() must see `ready` on the very frame it schedules (state would commit later).
  const ready = useRef(false)
  const marked = useRef(false)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let live = true
    void import('#rapier').then(async (RAPIER) => {
      const r: unknown = RAPIER
      if (typeof r === 'object' && r !== null && 'init' in r && typeof r.init === 'function') {
        await (r.init as () => Promise<void>)()
      }
      if (!live) return
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
      world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1, 0))
      world.step()
      ready.current = true
      invalidate()
    })
    return () => {
      live = false
    }
  }, [invalidate])
  useFrame(() => {
    if (ready.current && !marked.current) {
      marked.current = true
      markWorldPlayable(performance)
    }
  })
  return (
    <mesh>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

export function World() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas frameloop="demand">
        <ambientLight intensity={1} />
        <Scene />
      </Canvas>
    </div>
  )
}
