// The React Three Fiber mirror of the World model (plan §5, Scene loop ↔ model; ADR 0009): owns the
// fixed-timestep accumulator, steps the model from the key state (the loop's rule is stepFrame.ts),
// renders the Puck mesh and the camera goal from the state interpolated between the last two steps,
// eases the Follow Camera and records `world-playable`. Nothing here steps physics outside
// `model.step`. The one file fetched is the ice texture, same-origin, before the World is playable
// (#55); the Banner's texture is drawn on a canvas, no font.
//
// 'wasm-unsafe-eval' in the CSP (ADR 0012) exists for this import: the compat package inlines
// Rapier's wasm and instantiates it in the page.
import RAPIER from '@dimforge/rapier3d-compat'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Mesh,
  type Texture,
} from 'three'

import type { WorldFailure } from '../../app/types'
import { markOnce, WORLD_PLAYABLE_MARK } from '../../perf/marks'
import { createKeyState, handlesCode, isDriveCode } from '../input/keyboard'
import { cameraFollow, cameraGoal, RIG, type CameraPose } from '../model/camera'
import {
  blueLineOffset,
  centreLinePieces,
  type Rect,
  type Segment,
  type WorldLayout,
} from '../model/layout'
import {
  boardBoxes,
  createWorldModel,
  FIXED_DT,
  PUCK,
  type PuckState,
  type WorldEvent,
  type WorldModel,
} from '../model/world'
import { Banner } from './Banner'
import { BLUE, ICE_COLOUR, RED } from './colours'
import { Goal } from './Goal'
import { iceUv } from './ice'
import iceUrl from './ice.webp'
import { MAX_ANISOTROPY } from './marking'
import { interpolatePuck, renderAlpha } from './interpolate'
import { IceLine, Solid } from './Solid'
import { stepFrame } from './stepFrame'
import './world.css'

/** What the overlay's Reset control reaches (plan §5, corrected by T5b, #29): the same Reset as R. */
export type WorldHandle = { reset: () => void }

export type WorldCanvasProps = {
  layout: WorldLayout
  paused: boolean
  reducedMotion: boolean
  onEvent: (e: WorldEvent) => void
  onReady: () => void
  onFailure: (f: WorldFailure) => void
  handle: RefObject<WorldHandle | null>
}

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

/** A load step's failure, carrying the kind the app reports it as. */
class LoadFailure extends Error {
  constructor(readonly failure: WorldFailure) {
    super(failure.message)
  }
}

/** Rethrows a load step's error as the failure of `kind`, its message prefixed with `what`. */
function failAs(kind: WorldFailure['kind'], what?: string) {
  return (error: unknown): never => {
    const message = what === undefined ? messageOf(error) : `${what}: ${messageOf(error)}`
    throw new LoadFailure({ kind, message })
  }
}

/** The ice texture tiles in world space (ice.ts) and carries the ice's tint, so the colour goes white. */
function dressIce(material: MeshStandardMaterial, texture: Texture, anisotropy: number): void {
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = Math.min(anisotropy, MAX_ANISOTROPY)
  material.map = texture
  material.color.set('#ffffff')
  material.needsUpdate = true
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

function Scene({
  layout,
  paused,
  reducedMotion,
  onEvent,
  onReady,
  onFailure,
  handle,
}: WorldCanvasProps) {
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
  const gl = useThree((state) => state.gl)
  // One material for all the ice: plain ice colour until the texture is in, then the texture.
  const iceMaterial = useMemo(() => new MeshStandardMaterial({ color: ICE_COLOUR }), [])
  useEffect(
    () => () => {
      iceMaterial.map?.dispose()
      iceMaterial.dispose()
    },
    [iceMaterial],
  )

  useEffect(() => {
    callbacks.current = { onEvent, onReady, onFailure }
  }, [onEvent, onReady, onFailure])

  // Rapier initialises on mount, not at chunk evaluation (plan §9 risk 2), while the ice texture
  // loads; the World is ready when both are, so `world-playable` is recorded with the ice on screen
  // and the texture counts in the download until playable (plan §7 line 3, corrected by #55). A
  // texture that fails to load is a deploy asset like the chunk: a 'bundle' failure. Readiness is
  // a ref: the frame that invalidate() schedules must see it (ADR 0010).
  useEffect(() => {
    let live = true
    const ice = new TextureLoader().loadAsync(iceUrl)
    Promise.all([
      RAPIER.init().catch(failAs('physics')),
      ice.catch(failAs('bundle', 'the ice texture did not load')),
    ])
      .then(([, texture]) => {
        if (!live) {
          texture.dispose()
          return
        }
        iceMaterial.map?.dispose()
        dressIce(iceMaterial, texture, gl.capabilities.getMaxAnisotropy())
        const created = createWorldModel(RAPIER, layout)
        model.current = created
        states.current = snapTo(created)
        pose.current = cameraGoal(created.puck().position)
        invalidate()
      })
      .catch((error: unknown) => {
        // A texture that loaded while Rapier failed is not used: free it. Its own failure is the
        // one being reported here, so the second handler has nothing left to report.
        ice.then(
          (texture) => {
            texture.dispose()
          },
          () => undefined,
        )
        if (!live) return
        callbacks.current.onFailure(
          error instanceof LoadFailure
            ? error.failure
            : { kind: 'physics', message: messageOf(error) },
        )
      })
    return () => {
      live = false
      model.current?.dispose()
      model.current = null
      states.current = null
    }
  }, [layout, invalidate, iceMaterial, gl])

  // Reset (AC-12.1): the model's, then a snap of both render states so nothing is blended, and
  // the camera at its goal; R and the overlay's control (AC-12.2) both end here.
  const resetNow = useCallback((): void => {
    const world = model.current
    if (world === null) return
    world.reset()
    states.current = snapTo(world)
    pose.current = cameraGoal(world.puck().position)
    invalidate()
  }, [invalidate])
  useImperativeHandle(handle, () => ({ reset: resetNow }), [resetNow])

  useEffect(() => {
    const listener = (type: 'keydown' | 'keyup') => (event: KeyboardEvent) => {
      if (!handlesCode(event.code)) return
      // A shortcut (Ctrl+R, Alt+Left, Cmd+A) belongs to the browser; a keyup is always taken so a
      // held direction is released. While paused nothing is forwarded (AC-6.1: the Puck keeps
      // its state): the key router (src/app/keys.ts) owns Enter, Space and Escape then.
      if (type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey)) return
      if (type === 'keydown' && pausedRef.current) return
      // Steering keys would scroll the page; Enter, Space and Escape keep their default so the
      // overlay's control and the Title Screen's links work.
      if (isDriveCode(event.code)) event.preventDefault()
      const command = keys.onKey({ code: event.code, type })
      if (command === 'reset') resetNow()
    }
    const onKeyDown = listener('keydown')
    const onKeyUp = listener('keyup')
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
  }, [keys, resetNow])

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
    // The ref, not the prop: it is synced from the store's paused state (the only source of
    // truth) by the effect above, and the callback must not step on a stale capture.
    if (!pausedRef.current && !skipFrame.current) {
      accumulator.current = stepFrame(accumulator.current, dt, () => {
        const events = world.step(keys.input)
        puckStates.previous = puckStates.current
        puckStates.current = world.puck()
        for (const event of events) callbacks.current.onEvent(event)
        return events
      })
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
      <Ice rect={layout.hub.rect} material={iceMaterial} markings />
      <Ice rect={layout.path.rect} material={iceMaterial} />
      {layout.zones.map((zone) => (
        <group key={zone.exhibitId}>
          <Ice rect={zone.rect} material={iceMaterial} markings around={zone.banner.rect} />
          <Banner banner={zone.banner} />
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

/**
 * An ice slab with the shared ice material, its texture laid in world space (ice.ts); a Rink gets
 * the prototype's markings: the red centre line and the blue lines at a sixth of the length. The
 * centre line leaves a gap `around` a Banner (corrected by #55).
 */
function Ice({
  rect,
  material,
  markings = false,
  around,
}: {
  rect: Rect
  material: MeshStandardMaterial
  markings?: boolean
  around?: Rect
}) {
  const uv = useMemo(() => new Float32Array(iceUv(rect)), [rect])
  const { x, z } = rect.centre
  const blue = blueLineOffset(rect)
  const centre: Segment[] =
    around === undefined
      ? [{ a: { x: x - rect.width / 2, z }, b: { x: x + rect.width / 2, z } }]
      : centreLinePieces(rect, around)
  return (
    <>
      <mesh position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[rect.width, rect.length]}>
          <bufferAttribute attach="attributes-uv" args={[uv, 2]} />
        </planeGeometry>
      </mesh>
      {markings && (
        <>
          {centre.map((piece) => (
            <IceLine
              key={piece.a.x}
              x={(piece.a.x + piece.b.x) / 2}
              z={piece.a.z}
              width={piece.b.x - piece.a.x}
              colour={RED}
            />
          ))}
          {[z - blue, z + blue].map((lineZ) => (
            <IceLine key={lineZ} x={x} z={lineZ} width={rect.width} colour={BLUE} />
          ))}
        </>
      )}
    </>
  )
}
