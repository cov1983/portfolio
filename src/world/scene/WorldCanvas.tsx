// The React Three Fiber mirror of the World model (plan §5, Scene loop ↔ model; ADR 0009): owns
// the fixed-timestep accumulator, steps the model from the key state, copies the Puck pose into
// its mesh, eases the Follow Camera and records `world-playable`. Nothing here steps physics
// outside `model.step`, and nothing is fetched: no texture, no font.
//
// 'wasm-unsafe-eval' in the CSP (ADR 0012) exists for this import: the compat package inlines
// Rapier's wasm and instantiates it in the page.
import RAPIER from '@dimforge/rapier3d-compat'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Mesh } from 'three'

import type { WorldFailure } from '../../app/types'
import { markOnce, WORLD_PLAYABLE_MARK } from '../../perf/marks'
import { createKeyState, handlesCode } from '../input/keyboard'
import { cameraFollow, cameraGoal, RIG, type CameraPose } from '../model/camera'
import type { Rect, Segment, WorldLayout } from '../model/layout'
import {
  boardBox,
  createWorldModel,
  FIXED_DT,
  PUCK,
  type WorldEvent,
  type WorldModel,
} from '../model/world'
import './world.css'

export type WorldCanvasProps = {
  layout: WorldLayout
  paused: boolean
  reducedMotion: boolean
  onEvent: (e: WorldEvent) => void
  onReady: () => void
  onFailure: (f: WorldFailure) => void
}

/** A frame longer than this (a tab in the background) counts as this: no catch-up burst. */
const MAX_FRAME_DT = 0.1
/** Steps one frame may run; past that the remainder is dropped so a stall never spirals. */
const MAX_STEPS_PER_FRAME = 4
const ICE_COLOUR = '#eef4f8'
const LINE_WIDTH = 0.3
const LINE_HEIGHT = 0.01

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function WorldCanvas(props: WorldCanvasProps) {
  return (
    <div className="world">
      <Canvas
        frameloop={props.paused ? 'demand' : 'always'}
        camera={{
          fov: RIG.fovDeg,
          near: 0.1,
          far: 200,
          position: [RIG.offset.x, RIG.offset.y, RIG.offset.z],
        }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  )
}

function Scene({ layout, paused, reducedMotion, onEvent, onReady, onFailure }: WorldCanvasProps) {
  const [keys] = useState(createKeyState)
  const model = useRef<WorldModel | null>(null)
  const pose = useRef<CameraPose | null>(null)
  const accumulator = useRef(0)
  const skipFrame = useRef(false)
  const marked = useRef(false)
  const puckMesh = useRef<Mesh>(null)
  const callbacks = useRef({ onEvent, onReady, onFailure })
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    callbacks.current = { onEvent, onReady, onFailure }
  }, [onEvent, onReady, onFailure])

  // Rapier initialises on mount, not at chunk evaluation (plan §9 risk 2). Readiness is a ref:
  // the frame that invalidate() schedules must see it (ADR 0010).
  useEffect(() => {
    let live = true
    RAPIER.init()
      .then(() => {
        if (!live) return
        const created = createWorldModel(RAPIER, layout)
        model.current = created
        pose.current = cameraGoal(created.puck().position)
        invalidate()
      })
      .catch((error: unknown) => {
        if (live) callbacks.current.onFailure({ kind: 'physics', message: messageOf(error) })
      })
    return () => {
      live = false
      model.current?.dispose()
      model.current = null
    }
  }, [layout, invalidate])

  useEffect(() => {
    const handle = (type: 'keydown' | 'keyup') => (event: KeyboardEvent) => {
      if (!handlesCode(event.code)) return
      event.preventDefault()
      const command = keys.onKey({ code: event.code, type })
      const current = model.current
      if (command === 'reset' && current !== null) {
        current.reset()
        pose.current = cameraGoal(current.puck().position) // snap, AC-12.1
        invalidate()
      }
    }
    const onKeyDown = handle('keydown')
    const onKeyUp = handle('keyup')
    const onBlur = () => {
      keys.clear()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [keys, invalidate])

  // On resume the accumulator is cleared and the resume frame's long delta is skipped.
  useEffect(() => {
    if (!paused) {
      accumulator.current = 0
      skipFrame.current = true
    }
  }, [paused])

  useFrame((state, dt) => {
    const current = model.current
    if (current === null) return
    if (!marked.current) {
      marked.current = true
      markOnce(performance, WORLD_PLAYABLE_MARK)
      callbacks.current.onReady()
    }
    if (!paused && !skipFrame.current) {
      accumulator.current += Math.min(dt, MAX_FRAME_DT)
      let steps = 0
      while (accumulator.current >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        for (const event of current.step(keys.input)) callbacks.current.onEvent(event)
        accumulator.current -= FIXED_DT
        steps += 1
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0
    }
    skipFrame.current = false
    const puck = current.puck()
    puckMesh.current?.position.set(puck.position.x, puck.height, puck.position.z)
    const goal = cameraGoal(puck.position)
    const next = pose.current === null ? goal : cameraFollow(pose.current, goal, dt, reducedMotion)
    pose.current = next
    state.camera.position.set(next.position.x, next.position.y, next.position.z)
    state.camera.lookAt(next.target.x, next.target.y, next.target.z)
  })

  const { rect, resetPoint } = layout.hub
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <Ice rect={rect} />
      {layout.hub.boards.map((segment, i) => (
        <Board key={i} segment={segment} rect={rect} />
      ))}
      <mesh ref={puckMesh} position={[resetPoint.x, PUCK.height / 2, resetPoint.z]}>
        <cylinderGeometry args={[PUCK.radius, PUCK.radius, PUCK.height, 32]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </>
  )
}

/** The ice with the prototype's markings: the centre line and the blue lines at a sixth of the length. */
function Ice({ rect }: { rect: Rect }) {
  const { x, z } = rect.centre
  const blue = rect.length / 6
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rect.width, rect.length]} />
        <meshStandardMaterial color={ICE_COLOUR} />
      </mesh>
      {[
        { z: 0, colour: '#c8102e' },
        { z: -blue, colour: '#1f5fbf' },
        { z: blue, colour: '#1f5fbf' },
      ].map((line) => (
        <mesh key={line.z} position={[0, LINE_HEIGHT / 2, line.z]}>
          <boxGeometry args={[rect.width, LINE_HEIGHT, LINE_WIDTH]} />
          <meshStandardMaterial color={line.colour} />
        </mesh>
      ))}
    </group>
  )
}

/** One board, the same box as its collider. */
function Board({ segment, rect }: { segment: Segment; rect: Rect }) {
  const { centre, size } = boardBox(segment, rect)
  return (
    <mesh position={[centre.x, centre.y, centre.z]}>
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshStandardMaterial color="#d9dde2" />
    </mesh>
  )
}
