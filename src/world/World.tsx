// The entry of the `world` chunk: the whole World (Hub, Path, Zone), its scene and its HTML
// container, mounted by src/app/App.tsx paused and hidden behind the Title Screen (plan §2) and
// shown on entry. The container is the Visitor's keyboard home in the World: focusable, inert and
// invisible while the Title Screen is shown (`inert` hides it from assistive technology and the
// tab order; world.css makes it `visibility: hidden`, never `display: none`, so the canvas keeps
// its size and the paused demand frame that records world-playable still renders).
import { useCallback, useRef, useState, useSyncExternalStore, type RefObject } from 'react'

import type { WorldFailure } from '../app/types'
import { PLACEHOLDER_EXHIBIT, worldLayout } from './model/layout'
import type { WorldEvent } from './model/world'
import { WorldOverlay } from '../site/WorldOverlay'
import { WorldCanvas, type WorldHandle } from './scene/WorldCanvas'

// T7's layoutFromContent builds the layout from the content; until then the one Zone is the placeholder.
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export type WorldProps = {
  /** The scene steps only while false (selectWorldPaused): the Title Screen or a Panel owns the keys otherwise. */
  paused: boolean
  /** The Title Screen is shown over the World: inert and invisible, state preserved (AC-6.1). */
  hidden: boolean
  /** The container, so the app can focus it (plan §5, focusAfter). */
  containerRef: RefObject<HTMLElement | null>
  onReady: () => void
  onEvent: (event: WorldEvent) => void
  onFailure: (failure: WorldFailure) => void
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

export function World({ paused, hidden, containerRef, onReady, onEvent, onFailure }: WorldProps) {
  // Subscribed, so a change of the preference while the World runs applies at once (AC-11.3).
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion)
  // The placeholder of #25: "Goal" while the Puck is in the net, so the re-arm is visible. The
  // Goal events stay here until T7 routes them to the store (the reducer would open the Exhibit
  // Panel's state and pause the World without a Panel to show); the Zone's entry reaches the
  // store now, for the caption's place (T8a renders it).
  const [goalShown, setGoalShown] = useState(false)
  const handle = useRef<WorldHandle>(null)
  // The overlay's Reset: the model's Reset through the scene's handle, then focus back to the
  // container so the steering keys work without clicking into the World (AC-12.2; spec, Focus
  // handling). Not a state transition, so not focusAfter's (src/app/focus.ts).
  const onReset = useCallback(() => {
    handle.current?.reset()
    containerRef.current?.focus()
  }, [containerRef])
  const handleEvent = useCallback(
    (event: WorldEvent) => {
      if (event.type === 'goal') setGoalShown(true)
      else if (event.type === 'goal-left') setGoalShown(false)
      else onEvent(event)
    },
    [onEvent],
  )
  return (
    <section
      className="world-container"
      aria-label="World"
      tabIndex={-1}
      inert={hidden}
      ref={containerRef}
    >
      <WorldCanvas
        layout={layout}
        paused={paused}
        reducedMotion={reducedMotion}
        onEvent={handleEvent}
        onReady={onReady}
        onFailure={onFailure}
        handle={handle}
      />
      <WorldOverlay onReset={onReset} />
      <p className="world-goal" role="status">
        {goalShown ? 'Goal' : ''}
      </p>
    </section>
  )
}
