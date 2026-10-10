// PROTOTYPE (chore/prototype-q1-q4, throwaway): the `world` chunk, unsplit. three + React Three
// Fiber + Rapier in one chunk (`#rapier` is the compat or the wasm package, chosen at build time in
// vite.config.ts). One mesh behind the Title Screen, frameloop="demand"; Rapier is initialised in
// the mount, one world is stepped once, one frame is rendered and `world-playable` is recorded.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as RAPIER from '#rapier'

import { markWorldPlayable } from '../perf/world-playable'

/** The compat package needs `init()` (decodes the inlined base64 wasm); the wasm package loaded at import. */
async function initRapier(): Promise<void> {
  const r: unknown = RAPIER
  if (typeof r === 'object' && r !== null && 'init' in r && typeof r.init === 'function') {
    await (r.init as () => Promise<void>)()
  }
}

function Scene() {
  // A ref, not state: invalidate() must see `ready` on the very frame it schedules (state would commit later).
  const ready = useRef(false)
  const marked = useRef(false)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let live = true
    void initRapier().then(() => {
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
