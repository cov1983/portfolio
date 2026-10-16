// Capability detection (plan §5; spec, Devices and capability): runs after hydration and only ever
// adds hints (T8b) or withholds the preload (T5b); it never removes the way into the World.
// T5a detects the coarse pointer alone; T8b adds the WebGL probe. Reduced motion is read live by
// src/world/World.tsx, not here (plan §5, corrected by #32).
import type { Capability } from './store.ts'

/** `window.matchMedia` narrowed to what detection reads, so the detection is unit-tested without a DOM. */
export type MediaMatcher = (query: string) => { matches: boolean }

export const COARSE_POINTER_QUERY = '(pointer: coarse)'

export function detectCapability(matchMedia: MediaMatcher): Capability {
  return { coarsePointer: matchMedia(COARSE_POINTER_QUERY).matches }
}
