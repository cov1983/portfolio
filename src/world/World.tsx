// The entry of the `world` chunk: the Hub layout and the scene, unpaused and alone on the page
// until T5b mounts it behind the Title Screen through the store.
import { useSyncExternalStore } from 'react'

import type { WorldFailure } from '../app/types'
import { hubLayout } from './model/layout'
import { WorldCanvas } from './scene/WorldCanvas'

const layout = hubLayout()
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function ignore(): void {
  // T2 routes events to the store; nothing listens yet.
}

// Structured, no personal data; T8b turns it into the readable message with the Fallback link.
function reportFailure(failure: WorldFailure): void {
  console.error('World failed', failure)
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches
}

export function World() {
  // Subscribed, so a change of the preference while the World runs applies at once (AC-11.3).
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion)
  return (
    <WorldCanvas
      layout={layout}
      paused={false}
      reducedMotion={reducedMotion}
      onEvent={ignore}
      onReady={ignore}
      onFailure={reportFailure}
    />
  )
}
