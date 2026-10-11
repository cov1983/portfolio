// The React Three Fiber mirror of the World model (plan §5, Scene loop ↔ model; ADR 0009): owns
// the fixed-timestep accumulator, steps the model from the key state, renders the Puck mesh and
// the camera goal from the state interpolated between the last two steps, eases the Follow
// Camera and records `world-playable`. Nothing here steps physics outside `model.step`, and
// nothing is fetched: the Banner's texture is drawn on a canvas, no font.
//
// 'wasm-unsafe-eval' in the CSP (ADR 0012) exists for this import: the compat package inlines
// Rapier's wasm and instantiates it in the page.
import RAPIER from '@dimforge/rapier3d-compat'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mesh } from 'three'

import type { WorldFailure } from '../../app/types'
import { markOnce, WORLD_PLAYABLE_MARK } from '../../perf/marks'
import { createKeyState, handlesCode, isDriveCode } from '../input/keyboard'
import { cameraFollow, cameraGoal, RIG, type CameraPose } from '../model/camera'
import { blueLineOffset, type Rect, type WorldLayout } from '../model/layout'
import {
  boardBoxes,
  createWorldModel,
  FIXED_DT,
  PUCK,
  type PuckState,
  type WorldEvent,
  type WorldModel,
} from '../model/world'
import { Goal } from './Goal'
import { interpolatePuck, renderAlpha } from './interpolate'
import { IceLine, Solid } from './Solid'
import './world.css'

export type WorldCanvasProps = {
  layout: WorldLayout
  paused: boolean
  reducedMotion: boolean
  onEvent: (e: WorldEvent) => void
  onReady: () => void
  onFailure: (f: WorldFailure) => void
}

// Plan §5: a frame longer than 0.1 s (a tab in the background) counts as 0.1 s, and one frame runs
// at most four steps (0.067 s), after which the remainder is dropped so a stall never spirals.
// Below 15 fps the World therefore runs slower than real time, by design: the Visitor sees a
// slower Puck, never a jump.
const MAX_FRAME_DT = 0.1
const MAX_STEPS_PER_FRAME = 4
const ICE_COLOUR = '#eef4f8'
const BOARD_COLOUR = '#d9dde2'

/** The last two model states; what the frame renders lies between them (interpolate.ts). */
type PuckStates = { previous: PuckState; current: PuckState }

/** Both states at the model's state: a snap, nothing to blend. */
function snapTo(model: WorldModel): PuckStates {
  const state = model.puck()
  return { previous: state, current: state }
}
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
  const states = useRef<PuckStates | null>(null)
  const pose = useRef<CameraPose | null>(null)
  const pausedRef = useRef(paused)
  const accumulator = useRef(0)
  const skipFrame = useRef(false)
  const firstFrameRendered = useRef(false)
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
        states.current = snapTo(created)
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
      states.current = null
    }
  }, [layout, invalidate])

  useEffect(() => {
    const handle = (type: 'keydown' | 'keyup') => (event: KeyboardEvent) => {
      if (!handlesCode(event.code)) return
      // A shortcut (Ctrl+R, Alt+Left, Cmd+A) belongs to the browser; a keyup is always taken so a
      // held direction is released. While paused nothing is forwarded (AC-6.1: the Puck keeps
      // its state); T5a's key router takes this decision over.
      if (type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey)) return
      if (type === 'keydown' && pausedRef.current) return
      // Steering keys would scroll the page; Enter, Space and Escape keep their default so the
      // Title Screen's links and controls work once T4 adds them (T5a's key router decides then).
      if (isDriveCode(event.code)) event.preventDefault()
      const command = keys.onKey({ code: event.code, type })
      const world = model.current
      if (command === 'reset' && world !== null) {
        world.reset()
        states.current = snapTo(world) // snap, AC-12.1: both states, so nothing is blended
        pose.current = cameraGoal(world.puck().position)
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

  // On resume the accumulator is cleared and the resume frame's long delta is skipped; the render
  // state is the model's (the Puck keeps its state, AC-6.1), not a blend towards it.
  useEffect(() => {
    pausedRef.current = paused
    if (!paused) {
      accumulator.current = 0
      skipFrame.current = true
      if (states.current !== null) states.current.previous = states.current.current
    }
  }, [paused])

  useFrame((state, dt) => {
    const world = model.current
    const puckStates = states.current
    if (world === null || puckStates === null) return
    // The spec marks "World playable" when the first frame after physics initialisation has
    // rendered: this callback runs before R3F renders the frame, so the first ready frame asks for
    // one more and the second records the mark (the listener was attached by the mount effect).
    if (!marked.current) {
      if (firstFrameRendered.current) {
        marked.current = true
        markOnce(performance, WORLD_PLAYABLE_MARK)
        callbacks.current.onReady()
      } else {
        firstFrameRendered.current = true
        state.invalidate()
      }
    }
    if (!paused && !skipFrame.current) {
      accumulator.current += Math.min(dt, MAX_FRAME_DT)
      let steps = 0
      while (accumulator.current >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        const events = world.step(keys.input)
        puckStates.previous = puckStates.current
        puckStates.current = world.puck()
        for (const event of events) callbacks.current.onEvent(event)
        accumulator.current -= FIXED_DT
        steps += 1
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0
    }
    skipFrame.current = false
    // A frame holds 0, 1 or 2 steps, so the model's latest state moves in irregular jumps from
    // frame to frame; the mesh and the camera goal take the state the accumulator's remainder
    // points at between the last two steps, which moves smoothly (standard fixed-timestep
    // interpolation, up to one step behind the model).
    const puck = interpolatePuck(
      puckStates.previous,
      puckStates.current,
      renderAlpha(accumulator.current, FIXED_DT),
    )
    puckMesh.current?.position.set(puck.position.x, puck.height, puck.position.z)
    const goal = cameraGoal(puck.position)
    const next = pose.current === null ? goal : cameraFollow(pose.current, goal, dt, reducedMotion)
    pose.current = next
    state.camera.position.set(next.position.x, next.position.y, next.position.z)
    state.camera.lookAt(next.target.x, next.target.y, next.target.z)
  })

  const boards = useMemo(() => boardBoxes(layout), [layout])
  const { resetPoint } = layout.hub
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <Ice rect={layout.hub.rect} markings />
      <Ice rect={layout.path.rect} />
      {layout.zones.map((zone) => (
        <group key={zone.exhibitId}>
          <Ice rect={zone.rect} markings />
          <Goal zone={zone} />
        </group>
      ))}
      {boards.map((box, i) => (
        <Solid key={i} box={box} colour={BOARD_COLOUR} />
      ))}
      <mesh ref={puckMesh} position={[resetPoint.x, PUCK.height / 2, resetPoint.z]}>
        <cylinderGeometry args={[PUCK.radius, PUCK.radius, PUCK.height, 32]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </>
  )
}

/** An ice slab; a Rink gets the prototype's markings: the centre line and the blue lines at a sixth of the length. */
function Ice({ rect, markings = false }: { rect: Rect; markings?: boolean }) {
  const { x, z } = rect.centre
  const blue = blueLineOffset(rect)
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rect.width, rect.length]} />
        <meshStandardMaterial color={ICE_COLOUR} />
      </mesh>
      {markings &&
        [
          { z: 0, colour: '#c8102e' },
          { z: -blue, colour: '#1f5fbf' },
          { z: blue, colour: '#1f5fbf' },
        ].map((line) => (
          <IceLine key={line.z} x={0} z={line.z} width={rect.width} colour={line.colour} />
        ))}
    </group>
  )
}
