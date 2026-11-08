// The hero's backdrop, derived (spec increment-2 AC-2.1, D2, D6; ADR 0017; Owner, #103 comment
// 6726409397): one standalone SVG the Title Screen shows as its backdrop's one background image.
// The ice grid is projected through the Follow Camera (RIG, src/world/model/camera.ts: the camera
// 9 m up and 13 m behind the Puck, looking at the ice under it, a 50° vertical field of view) into
// a 1600 × 900 view, so the browser draws flat lines instead of a 3D-transformed layer. Crosses
// mark one cell centre in four; the static blue edge glow and the foot fade into the page's
// background are baked in. Every colour is read from the token layer (src/site/tokens.css), never
// written here, and tests/build/tokens.test.ts ties the emitted file to it. The Puck is not drawn:
// the page sets the unchanged Mark over the centre. Geometry is clipped to the view: under `cover`
// every aspect ratio shows a sub-rectangle of it, and the foot fade is transparent at its bottom
// edge. The derived-files plugin of vite.config.ts emits the file at the output root in the build
// and serves it in dev, from the same source.
import { RIG, type Rig, type Vec3 } from '../src/world/model/camera.ts'
import type { EmittedFile } from './images.ts'

/** The token layer, relative to the repository root. */
export const TOKENS_SOURCE = 'src/site/tokens.css'
/** The emitted file, at the output root: /hero-backdrop.svg. */
export const BACKDROP_FILE = 'hero-backdrop.svg'

/** The view the grid is projected into, in px. */
export const VIEW = { width: 1600, height: 900 }
/** Metres per grid cell: 64 px at the Puck, the size of the flat pattern it replaces. */
const CELL = 1.05
/** The drawn ice, in metres around the Puck: far edge, near edge, half width. */
const ICE = { far: -60, near: 12, side: 60 }
/** Crosses stand no farther than this; beyond it they shrink below a pixel. */
const CROSS_FAR = -30
/** Half a cross arm, in metres. */
const ARM = 0.1
/** One cell centre in four carries a cross: every second one along each axis. */
const CROSS_STRIDE = 2
/** A clipped segment shorter than this many px is not drawn. */
const MIN_LENGTH = 0.5

export type Point = readonly [number, number]

/** The token colours the backdrop draws, each as written in tokens.css. */
export type BackdropColours = {
  /** The foot fade's mask: the page's background. */
  background: string
  /** The grid lines. */
  border: string
  /** The crosses. */
  primary: string
  /** The edge glow, translucent. */
  glow: string
}

/** The backdrop's colours read from the token layer's text; a missing token is an error. */
export function tokenColours(tokensCss: string): BackdropColours {
  const read = (name: string): string => {
    const match = new RegExp(`--color-${name}:\\s*(#(?:[0-9a-f]{6}|[0-9a-f]{8}));`, 'i').exec(
      tokensCss,
    )
    if (match?.[1] === undefined) throw new Error(`${TOKENS_SOURCE} has no --color-${name}`)
    return match[1].toLowerCase()
  }
  return {
    background: read('background'),
    border: read('border'),
    primary: read('primary'),
    glow: read('glow'),
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / length, y: v.y / length, z: v.z / length }
}

/** The ice point (x, 0, z), the Puck at the origin, in view px as the Follow Camera sees it. */
export function project(x: number, z: number, rig: Rig = RIG): Point {
  const eye = rig.offset
  const forward = normalise({ x: -eye.x, y: -eye.y, z: -eye.z })
  const right = normalise(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  const v = { x: x - eye.x, y: -eye.y, z: z - eye.z }
  const depth = dot(v, forward)
  const scale = VIEW.height / 2 / Math.tan((rig.fovDeg * Math.PI) / 360)
  return [
    VIEW.width / 2 + (dot(v, right) / depth) * scale,
    VIEW.height / 2 - (dot(v, up) / depth) * scale,
  ]
}

/** The part of segment a–b inside the view (Liang–Barsky), or null when none is. */
export function clip(a: Point, b: Point): [Point, Point] | null {
  const [x0, y0] = a
  const dx = b[0] - x0
  const dy = b[1] - y0
  let lo = 0
  let hi = 1
  const edges: [number, number][] = [
    [-dx, x0],
    [dx, VIEW.width - x0],
    [-dy, y0],
    [dy, VIEW.height - y0],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) lo = Math.max(lo, r)
    else hi = Math.min(hi, r)
    if (lo > hi) return null
  }
  return [
    [x0 + lo * dx, y0 + lo * dy],
    [x0 + hi * dx, y0 + hi * dy],
  ]
}

/** One coordinate to a tenth of a px; a negative zero is written as zero. */
function coordinate(value: number): string {
  const text = value.toFixed(1)
  return text === '-0.0' ? '0.0' : text
}

function format(p: Point): string {
  return `${coordinate(p[0])} ${coordinate(p[1])}`
}

/** One path segment, clipped to the view; empty when nothing of it is seen. */
function segment(a: Point, b: Point): string {
  const clipped = clip(a, b)
  if (clipped === null) return ''
  const [from, to] = clipped
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < MIN_LENGTH) return ''
  return `M${format(from)}L${format(to)}`
}

function inView([x, y]: Point): boolean {
  return x >= 0 && x <= VIEW.width && y >= 0 && y <= VIEW.height
}

/** The grid lines' path data: lines along the ice's depth, then across it. */
export function gridPath(rig: Rig = RIG): string {
  const half = Math.trunc(ICE.side / CELL)
  const parts: string[] = []
  for (let i = -half; i <= half; i++)
    parts.push(segment(project(i * CELL, ICE.far, rig), project(i * CELL, ICE.near, rig)))
  for (let j = Math.trunc(ICE.far / CELL); j <= Math.trunc(ICE.near / CELL); j++)
    parts.push(segment(project(-ICE.side, j * CELL, rig), project(ICE.side, j * CELL, rig)))
  return parts.join('')
}

/** The crosses' path data: one cell centre in four within CROSS_FAR, each centre in view. */
export function crossPath(rig: Rig = RIG): string {
  const half = Math.trunc(ICE.side / CELL)
  const parts: string[] = []
  for (let i = -half; i < half; i++) {
    for (let j = Math.trunc(CROSS_FAR / CELL); j < Math.trunc(ICE.near / CELL); j++) {
      if (i % CROSS_STRIDE !== 0 || j % CROSS_STRIDE !== 0) continue
      const x = (i + 0.5) * CELL
      const z = (j + 0.5) * CELL
      if (!inView(project(x, z, rig))) continue
      parts.push(segment(project(x - ARM, z, rig), project(x + ARM, z, rig)))
      parts.push(segment(project(x, z - ARM, rig), project(x, z + ARM, rig)))
    }
  }
  return parts.join('')
}

/**
 * The backdrop SVG. The glow runs from transparent at 55 % of the half-diagonal to the glow token
 * at the corners; the foot fade is an alpha mask, opaque to 70 % of the height and transparent at
 * the bottom edge, painted in the background token so the file holds token colours only.
 */
export function backdropSvg(colours: BackdropColours, rig: Rig = RIG): string {
  const { width, height } = VIEW
  const c = colours
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">
<defs>
<radialGradient id="glow" cx=".5" cy=".5" r=".7071"><stop offset=".55" stop-color="${c.glow}" stop-opacity="0"/><stop offset="1" stop-color="${c.glow}"/></radialGradient>
<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stop-color="${c.background}"/><stop offset="1" stop-color="${c.background}" stop-opacity="0"/></linearGradient>
<mask id="foot-mask" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="${String(width)}" height="${String(height)}"><rect width="${String(width)}" height="${String(height)}" fill="url(#foot)"/></mask>
</defs>
<g mask="url(#foot-mask)">
<path fill="none" stroke="${c.border}" stroke-width="1" d="${gridPath(rig)}"/>
<path fill="none" stroke="${c.primary}" stroke-opacity=".6" stroke-width="1.5" d="${crossPath(rig)}"/>
<rect width="${String(width)}" height="${String(height)}" fill="url(#glow)"/>
</g>
</svg>
`
}

/** hero-backdrop.svg from the token layer's text, for the output root. */
export function backdropFiles(tokensCss: string): EmittedFile[] {
  return [{ fileName: BACKDROP_FILE, source: Buffer.from(backdropSvg(tokenColours(tokensCss))) }]
}
