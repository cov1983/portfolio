import { useEffect, useSyncExternalStore } from 'react'

import type { Content } from '../content/types.ts'
import { markOnce, TITLE_SCREEN_INTERACTIVE_MARK } from '../perf/marks.ts'
import { TitleScreen } from '../site/TitleScreen'
import { detectCapability } from './capability.ts'
import { INTERACTIVE_SELECTOR, keyAction, routeKey } from './keys.ts'
import type { Store } from './store.ts'

// The hydrated root (plan §2, module app; ADR 0010): the one tree both src/entry-prerender.tsx
// renders to a string and src/main.tsx hydrates, so the pre-rendered markup and the first client
// render come from the same component and the same initial state (tests/build/index-html.test.ts
// compares them). No DOM of its own: the markup is the Title Screen's. Outside the coverage ratchet
// (a component): seam 1 proves it.
type Props = { content: Content; store: Store }

export function App({ content, store }: Props) {
  // The third argument is the server snapshot renderToString needs; the state is the same.
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)

  // After the commit that attached the handlers: the Title Screen is interactive (plan §7 line 1),
  // then detection (spec: after hydration; T5b reads it for the preload, T8b for the hints), then
  // the key router. StrictMode mounts twice in dev: the mark and the dispatch are idempotent, the
  // listener is removed in the cleanup. focusAfter is not applied yet: no target it names exists
  // before T5b (the World container) and T6 (the Panel).
  useEffect(() => {
    markOnce(performance, TITLE_SCREEN_INTERACTIVE_MARK)
    store.dispatch({
      type: 'capability',
      capability: detectCapability((query) => window.matchMedia(query)),
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null
      const targetIsInteractive = target !== null && target.closest(INTERACTIVE_SELECTOR) !== null
      const action = keyAction(routeKey(store.getState(), targetIsInteractive), event.code)
      if (action === null) return
      event.preventDefault() // Space must not scroll the page it just acted on
      store.dispatch(action)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [store])

  // `entering` alone is the loading state: the reducer clears it on every path to a ready World
  // (store.test.ts proves the invariant), so no second condition is needed here.
  return (
    <TitleScreen
      content={content}
      loading={state.entering}
      onEnter={() => {
        store.dispatch({ type: 'enter' })
      }}
    />
  )
}
