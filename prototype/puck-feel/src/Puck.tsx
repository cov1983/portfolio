// PROTOTYPE — throwaway. The Puck under Direct Drive, plus the Follow Camera.
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody, CylinderCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { type Preset, telemetry } from './presets'

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'reset'

const PUCK = { radius: 0.5, height: 0.2 }
const START = new THREE.Vector3(0, PUCK.height / 2 + 0.05, 0)
const CAM_OFFSET = new THREE.Vector3(0, 9, 13) // behind along +Z, looking -Z (forward = -Z)

export function Puck({ preset }: { preset: Preset }) {
  const body = useRef<RapierRigidBody>(null)
  const [, get] = useKeyboardControls<Controls>()
  const camera = useThree((s) => s.camera)

  // scratch vectors, allocated once
  const dir = useRef(new THREE.Vector3()).current
  const pos = useRef(new THREE.Vector3()).current
  const camTarget = useRef(new THREE.Vector3()).current
  const lookTarget = useRef(new THREE.Vector3()).current
  const heading = useRef(new THREE.Vector3(0, 0, -1)).current
  const fwd = useRef(new THREE.Vector3()).current
  const right = useRef(new THREE.Vector3()).current

  useFrame((_, dt) => {
    const rb = body.current
    if (!rb) return
    const step = Math.min(dt, 1 / 30)
    const k = get()

    if (k.reset) {
      rb.setTranslation(START, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    // Direct Drive: a held direction accelerates the Puck that way, relative to the camera's yaw.
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    right.crossVectors(fwd, THREE.Object3D.DEFAULT_UP).normalize()
    dir.set(0, 0, 0)
    if (k.forward) dir.add(fwd)
    if (k.back) dir.sub(fwd)
    if (k.left) dir.sub(right)
    if (k.right) dir.add(right)
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(preset.accel * step) // mass = 1 → impulse = Δv
      rb.applyImpulse(dir, true)
    }

    // speed cap
    const v = rb.linvel()
    const speed = Math.hypot(v.x, v.z)
    if (speed > preset.maxSpeed) {
      const s = preset.maxSpeed / speed
      rb.setLinvel({ x: v.x * s, y: v.y, z: v.z * s }, true)
    }

    // Follow Camera: trails the Puck with lag. 'fixed' keeps world yaw; 'heading' swings behind travel.
    const t = rb.translation()
    pos.set(t.x, t.y, t.z)
    if (telemetry.camMode === 'heading' && speed > 1.5) {
      heading.lerp(new THREE.Vector3(v.x, 0, v.z).normalize(), 1 - Math.exp(-2 * step))
    }
    if (telemetry.camMode === 'heading') {
      camTarget.copy(heading).multiplyScalar(-CAM_OFFSET.z).setY(CAM_OFFSET.y).add(pos)
    } else {
      camTarget.copy(pos).add(CAM_OFFSET)
    }
    camera.position.lerp(camTarget, 1 - Math.exp(-4 * step))
    lookTarget.lerp(pos, 1 - Math.exp(-8 * step))
    camera.lookAt(lookTarget)

    telemetry.speed = speed
    telemetry.x = t.x
    telemetry.z = t.z
  })

  return (
    <RigidBody
      ref={body}
      key={preset.key} // remount on preset change so damping/friction props re-apply cleanly
      position={START.toArray()}
      colliders={false}
      linearDamping={preset.linearDamping}
      angularDamping={1}
      friction={preset.friction}
      restitution={preset.restitution}
      enabledRotations={[false, false, false]}
      ccd
    >
      <CylinderCollider args={[PUCK.height / 2, PUCK.radius]} mass={1} />
      <mesh castShadow>
        <cylinderGeometry args={[PUCK.radius, PUCK.radius, PUCK.height, 32]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
    </RigidBody>
  )
}
