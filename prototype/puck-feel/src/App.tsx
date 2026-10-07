// PROTOTYPE — throwaway. Question: which ice-friction preset makes the Puck feel right?
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { PRESETS, type Preset, telemetry } from './presets'
import { Rink } from './Rink'
import { Puck, type Controls } from './Puck'

const MAP: KeyboardControlsEntry<Controls>[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'reset', keys: ['KeyR'] },
]

export default function App() {
  const [preset, setPreset] = useState<Preset>(PRESETS['2'])
  const [, tick] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === '2' || e.key === '3') setPreset(PRESETS[e.key])
      if (e.key === 'c' || e.key === 'C') telemetry.camMode = telemetry.camMode === 'fixed' ? 'heading' : 'fixed'
    }
    window.addEventListener('keydown', onKey)
    const id = setInterval(() => tick((n) => n + 1), 100) // HUD poll
    return () => {
      window.removeEventListener('keydown', onKey)
      clearInterval(id)
    }
  }, [])

  return (
    <KeyboardControls map={MAP}>
      <Canvas shadows camera={{ position: [0, 9, 13], fov: 50 }}>
        <color attach="background" args={['#0b0f14']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
        <Physics gravity={[0, -9.81, 0]}>
          <Rink friction={preset.friction} restitution={preset.restitution} />
          <Puck preset={preset} />
        </Physics>
      </Canvas>
      <Hud preset={preset} />
    </KeyboardControls>
  )
}

function Hud({ preset }: { preset: Preset }) {
  const s = telemetry
  return (
    <div style={hud}>
      <div style={{ color: '#f66', fontWeight: 700 }}>PROTOTYPE — throwaway</div>
      <div style={{ fontSize: 20, marginTop: 6 }}>
        {(['1', '2', '3'] as const).map((k) => (
          <span key={k} style={{ marginRight: 12, opacity: k === preset.key ? 1 : 0.4, fontWeight: k === preset.key ? 700 : 400 }}>
            [{k}] {PRESETS[k].name}
          </span>
        ))}
      </div>
      <div style={{ opacity: 0.8, marginTop: 2 }}>{preset.blurb}</div>
      <table style={{ marginTop: 8, borderSpacing: '12px 0' }}>
        <tbody>
          <Row k="friction μ" v={preset.friction} />
          <Row k="linear damping" v={preset.linearDamping} />
          <Row k="accel m/s²" v={preset.accel} />
          <Row k="max speed m/s" v={preset.maxSpeed} />
          <Row k="board restitution" v={preset.restitution} />
        </tbody>
      </table>
      <div style={{ marginTop: 8 }}>
        speed <b>{s.speed.toFixed(1)}</b> m/s · pos ({s.x.toFixed(1)}, {s.z.toFixed(1)}) · camera <b>{s.camMode}</b>
      </div>
      <div style={{ marginTop: 8, opacity: 0.6 }}>WASD / arrows: Direct Drive · 1 2 3: preset · R: Reset · C: camera mode</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <tr>
      <td style={{ opacity: 0.7 }}>{k}</td>
      <td style={{ textAlign: 'right' }}>{v}</td>
    </tr>
  )
}

const hud: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  padding: '10px 14px',
  background: 'rgba(0,0,0,0.55)',
  color: '#eee',
  fontSize: 13,
  lineHeight: 1.4,
  borderRadius: 6,
  pointerEvents: 'none',
  userSelect: 'none',
}
