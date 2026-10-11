// The entry of the `world` chunk: the Hub layout and the scene, unpaused and alone on the page
// until T5b mounts it behind the Title Screen through the store.
import type { WorldFailure } from '../app/types'
import { hubLayout } from './model/layout'
import { WorldCanvas } from './scene/WorldCanvas'

const layout = hubLayout()

function ignore(): void {
  // T2 routes events to the store; nothing listens yet.
}

// Structured, no personal data; T8b turns it into the readable message with the Fallback link.
function reportFailure(failure: WorldFailure): void {
  console.error('World failed', failure)
}

export function World() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
