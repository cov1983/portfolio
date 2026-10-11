// The entry of the `world` chunk: the whole World (Hub, Path, Zone) and the scene, unpaused and
// alone on the page until T5b mounts it behind the Title Screen through the store.
import { useCallback, useState, useSyncExternalStore } from 'react'

import type { WorldFailure } from '../app/types'
import { PLACEHOLDER_EXHIBIT, worldLayout } from './model/layout'
import type { WorldEvent } from './model/world'
import { WorldCanvas } from './scene/WorldCanvas'

// T7's layoutFromContent builds the layout from the content; until then the one Zone is the placeholder.
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function ignore(): void {
  // T5b wires readiness into the store; nothing listens yet.
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
  // The placeholder of #25: "Goal" while the Puck is in the net, so the re-arm is visible. T7
  // routes the events to the store (ADR 0009: app state in one store, not component state) and
  // opens the Exhibit Panel instead.
  const [goalShown, setGoalShown] = useState(false)
  const onEvent = useCallback((event: WorldEvent) => {
    if (event.type === 'goal') setGoalShown(true)
    else if (event.type === 'goal-left') setGoalShown(false)
  }, [])
  return (
    <>
      <WorldCanvas
        layout={layout}
        paused={false}
        reducedMotion={reducedMotion}
        onEvent={onEvent}
        onReady={ignore}
        onFailure={reportFailure}
      />
      <p className="world-goal" role="status">
        {goalShown ? 'Goal' : ''}
      </p>
    </>
  )
}
