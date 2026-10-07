// PROTOTYPE — throwaway. One Rink: ice plane plus four boards.
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Grid } from '@react-three/drei'

export const RINK = { length: 40, width: 20, boardHeight: 1.2, boardThickness: 0.4 }

export function Rink({ friction, restitution }: { friction: number; restitution: number }) {
  const { length, width, boardHeight, boardThickness: t } = RINK
  const hl = length / 2
  const hw = width / 2
  return (
    <group>
      {/* ice */}
      <RigidBody type="fixed" friction={friction} restitution={0}>
        <CuboidCollider args={[hl, 0.5, hw]} position={[0, -0.5, 0]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[length, width]} />
          <meshStandardMaterial color="#dfeaf2" />
        </mesh>
      </RigidBody>
      <Grid
        args={[length, width]}
        position={[0, 0.01, 0]}
        cellSize={2}
        sectionSize={10}
        cellColor="#b9c9d6"
        sectionColor="#8aa0b4"
        fadeDistance={200}
        infiniteGrid={false}
      />
      {/* centre red line, two blue lines: speed cues */}
      <Line x={0} color="#d33" />
      <Line x={-hl / 3} color="#36c" />
      <Line x={hl / 3} color="#36c" />
      {/* boards */}
      <RigidBody type="fixed" friction={0} restitution={restitution}>
        <Board pos={[0, boardHeight / 2, -hw - t / 2]} size={[length + 2 * t, boardHeight, t]} />
        <Board pos={[0, boardHeight / 2, hw + t / 2]} size={[length + 2 * t, boardHeight, t]} />
        <Board pos={[-hl - t / 2, boardHeight / 2, 0]} size={[t, boardHeight, width]} />
        <Board pos={[hl + t / 2, boardHeight / 2, 0]} size={[t, boardHeight, width]} />
      </RigidBody>
    </group>
  )
}

function Board({ pos, size }: { pos: [number, number, number]; size: [number, number, number] }) {
  return (
    <>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={pos} />
      <mesh position={pos} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#f4f4f4" />
      </mesh>
    </>
  )
}

function Line({ x, color }: { x: number; color: string }) {
  return (
    <mesh position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.3, RINK.width]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}
