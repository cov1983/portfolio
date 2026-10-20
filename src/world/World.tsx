// The entry of the `world` chunk: the whole World (Hub, Path, Zone), its scene and its HTML
// container, mounted by src/app/App.tsx paused and hidden behind the Title Screen (plan §2) and
// shown on entry. The container is the Visitor's keyboard home in the World: focusable, inert and
// invisible while the Title Screen is shown (`inert` hides it from assistive technology and the
// tab order; world.css makes it `visibility: hidden`, never `display: none`, so the canvas keeps
// its size and the paused demand frame that records world-playable still renders).
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'

import { captionText } from '../app/caption'
import type { CaptionPlace } from '../app/store'
import type { WorldFailure } from '../app/types'
import type { Content } from '../content/types'
import { layoutFromContent } from './model/layout'
import type { WorldEvent } from './model/world'
import { WorldOverlay } from '../site/WorldOverlay'
import { WorldCanvas, type WorldHandle } from './scene/WorldCanvas'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export type WorldProps = {
  /** The site's content, which the app already holds: the World is built from it (layoutFromContent). */
  content: Content
  /** The scene steps only while false (selectWorldPaused): the Title Screen or a Panel owns the keys otherwise. */
  paused: boolean
  /** The Title Screen is shown over the World: inert and invisible, state preserved (AC-6.1). */
  hidden: boolean
  /**
   * The place of the Announcer caption on show, or null (the app times it, plan §5). Its text is
   * looked up here, so a missing caption fails in the World's code, which the app's failure
   * boundary around the World contains (src/app/FailureBoundary.tsx, #33): the readable message
   * replaces the World and the Title Screen stays.
   */
  captionPlace: CaptionPlace | null
  /** The container, so the app can focus it (plan §5, focusAfter). */
  containerRef: RefObject<HTMLElement | null>
  onReady: () => void
  /** Every World event, for the store: the Zone's entry sets the caption's place, the Goal opens the Panel (AC-14.1). */
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

export function World({
  content,
  paused,
  hidden,
  captionPlace,
  containerRef,
  onReady,
  onEvent,
  onFailure,
}: WorldProps) {
  // Once per content, which is a module constant: a new layout would rebuild the model in
  // WorldCanvas and put the Puck back at the Reset point.
  const layout = useMemo(() => layoutFromContent(content), [content])
  // Subscribed, so a change of the preference while the World runs applies at once (AC-11.3).
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion)
  const handle = useRef<WorldHandle>(null)
  // The overlay's Reset: the model's Reset through the scene's handle, then focus back to the
  // container so the steering keys work without clicking into the World (AC-12.2; spec, Focus
  // handling). Not a state transition, so not focusAfter's (src/app/focus.ts).
  const onReset = useCallback(() => {
    handle.current?.reset()
    containerRef.current?.focus()
  }, [containerRef])
  // The caption's live region is out of the accessibility tree while the section is inert, and a
  // screen reader announces only text that arrives in a region already there: the section leaves
  // inert in one commit, the caption's text follows a frame later (AC-18.2; ai-review on #57).
  // Scheduled in a layout effect, so the frame is requested in the commit that shows the World;
  // hiding it again (the cleanup) takes the text back, so every entry waits its frame. In a
  // background tab the browser may not run the frame before the ~5 s timer expires, so a Visitor
  // who enters and switches tabs at once can miss the caption: accepted for increment-1.
  const [announcing, setAnnouncing] = useState(false)
  useLayoutEffect(() => {
    if (hidden) return
    const frame = requestAnimationFrame(() => {
      setAnnouncing(true)
    })
    return () => {
      cancelAnimationFrame(frame)
      setAnnouncing(false)
    }
  }, [hidden])
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
        onEvent={onEvent}
        onReady={onReady}
        onFailure={onFailure}
        handle={handle}
      />
      <WorldOverlay
        caption={
          announcing && captionPlace !== null
            ? { place: captionPlace, text: captionText(content.captions, captionPlace) }
            : null
        }
        onReset={onReset}
      />
    </section>
  )
}
