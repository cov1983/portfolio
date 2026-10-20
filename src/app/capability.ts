// Capability detection (plan §5, corrected by #33; spec, Devices and capability): runs after
// hydration and only ever adds: a hint on the Title Screen with the Fallback link first (AC-21.1,
// 22.1) and the preload withheld (selectWorldPreload, store.ts); it never removes the way into
// the World. T5a detected the coarse pointer; T8b (#33) adds the WebGL probe. Reduced motion is
// read live by src/world/World.tsx, not here (plan §5, corrected by #32). Pure: the media matcher
// and the canvas come injected, so the detection is unit-tested without a DOM; src/app/App.tsx
// wires window.matchMedia and document.createElement.
import type { Capability } from './store.ts'
import type { WorldFailure } from './types.ts'

/** `window.matchMedia` narrowed to what detection reads, so the detection is unit-tested without a DOM. */
export type MediaMatcher = (query: string) => { matches: boolean }

export const COARSE_POINTER_QUERY = '(pointer: coarse)'

/** A WebGL context narrowed to the probe: the extension that releases it. */
export type ProbeContext = {
  getExtension: (name: 'WEBGL_lose_context') => { loseContext: () => void } | null
}

/** `HTMLCanvasElement` narrowed to the probe: a WebGL 2 context, or none. */
export type ProbeCanvas = { getContext: (id: 'webgl2') => ProbeContext | null }

/**
 * Whether the browser gives a WebGL 2 context, the only kind three renders with since r163
 * (`three` 0.186 here; ai-review on #64): a browser with WebGL 1 alone cannot run the World, so
 * it gets the hint. The context is released at once where the browser has the extension: a
 * browser allows few contexts, and the World needs its own.
 */
export function probeWebgl(createCanvas: () => ProbeCanvas): boolean {
  const canvas = createCanvas()
  const context = canvas.getContext('webgl2')
  if (context === null) return false
  context.getExtension('WEBGL_lose_context')?.loseContext()
  return true
}

export function detectCapability(matchMedia: MediaMatcher, webgl: () => boolean): Capability {
  return { coarsePointer: matchMedia(COARSE_POINTER_QUERY).matches, webgl: webgl() }
}

/**
 * The failure as reported: a throw during the World's render while the browser has no WebGL is
 * the WebGL failure (three cannot create its context) and is named so (Owner, #33 Q2); every
 * other failure is reported as it came.
 */
export function attributeFailure(
  failure: WorldFailure,
  capability: Capability | null,
): WorldFailure {
  return failure.kind === 'render' && capability?.webgl === false
    ? { ...failure, kind: 'webgl' }
    : failure
}
