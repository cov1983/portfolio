import { Canvas } from '@react-three/fiber'

// Phase 0b skeleton: proves that React, React Three Fiber and the build pipeline work end to end.
// No Rink, Puck or content lives here; increment-1 code starts in Phase 3 from its tickets.
export function App() {
  return (
    <main>
      <h1>Portfolio: toolchain skeleton</h1>
      <div style={{ height: '60vh' }}>
        <Canvas>
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
