import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import { markWorldPlayable } from './perf/world-playable'

// Records the world-playable mark on the first frame the render loop runs. In the skeleton that is
// the first frame at all; in increment-1 it moves to "first frame after physics initialisation with
// input wired" (spec, Implementation decisions). The perf CI job reads the mark from Lighthouse.
function MarkWorldPlayable() {
  const marked = useRef(false)
  useFrame(() => {
    if (!marked.current) {
      markWorldPlayable(performance)
      marked.current = true
    }
  })
  return null
}

// Phase 0b skeleton: proves that React, React Three Fiber and the build pipeline work end to end.
// No Rink, Puck or content lives here; increment-1 code starts in Phase 3 from its tickets.
export function App() {
  return (
    <main>
      <h1>Portfolio: toolchain skeleton</h1>
      <div style={{ height: '60vh' }}>
        <Canvas>
          <MarkWorldPlayable />
          <ambientLight intensity={1} />
          <mesh>
            <boxGeometry />
            <meshStandardMaterial color="orange" />
          </mesh>
        </Canvas>
      </div>
    </main>
  )
}
