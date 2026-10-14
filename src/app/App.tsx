import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { Content } from '../content/types.ts'
import { markOnce, TITLE_SCREEN_INTERACTIVE_MARK } from '../perf/marks.ts'
import { ExhibitPanel } from '../site/ExhibitPanel'
import { TitleScreen } from '../site/TitleScreen'
import type { World as WorldComponent } from '../world/World'
import { detectCapability } from './capability.ts'
import { focusAfter } from './focus.ts'
import { INTERACTIVE_SELECTOR, isPlainActivation, keyAction, routeKey } from './keys.ts'
import {
  createWorldLoader,
  idleScheduler,
  shouldLoadOnEntry,
  shouldPreload,
  type WorldLoader,
} from './preload.ts'
import { selectWorldPaused, type Store } from './store.ts'
import type { WorldFailure } from './types.ts'

// The hydrated root (plan §2, module app; ADR 0010): the one tree both src/entry-prerender.tsx
// renders to a string and src/main.tsx hydrates, so the pre-rendered markup and the first client
// render come from the same component and the same initial state (tests/build/index-html.test.ts
// compares them). The initial state renders the Title Screen alone; the World arrives by dynamic
// import (the entry chunk never imports it, ADR 0010) and mounts paused and hidden behind the
// Title Screen through the store (plan §2, Entry and preload policy). The Exhibit Panel renders
// while the store holds one (T6), so the initial state, and the pre-rendered markup, have none.
// Outside the coverage ratchet (a component): seam 1 proves it (tests/e2e/world-entry.spec.ts,
// world.spec.ts, exhibit-panel.spec.ts).
type Props = { content: Content; store: Store }

export function App({ content, store }: Props) {
  // The third argument is the server snapshot renderToString needs; the state is the same.
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  // The loaded chunk's component lives here, not in the store: the store stays React- and
  // module-free (ADR 0009). A function in useState needs the updater form.
  const [World, setWorld] = useState<typeof WorldComponent | null>(null)
  const worldRef = useRef<HTMLElement>(null)
  const entriesRef = useRef<HTMLElement>(null)
  const panelCloseRef = useRef<HTMLButtonElement>(null)
  const previous = useRef(state)
  const loaderRef = useRef<WorldLoader | null>(null)

  // Structured, no personal data (plan §7); T8b turns it into the readable message (AC-22.2) and
  // its test consumes this line through the shared fixture (noted on #33).
  const reportFailure = useCallback(
    (failure: WorldFailure) => {
      console.error('World failed', failure)
      store.dispatch({ type: 'world-failure', failure })
    },
    [store],
  )

  // After the commit that attached the handlers: the Title Screen is interactive (plan §7 line 1),
  // then detection (spec: after hydration; the preload reads it, T8b the hints), then the key
  // router and the World loader. StrictMode mounts twice in dev: the mark and the dispatch are
  // idempotent, the listeners are removed in the cleanup, the second loader's import is served
  // from the module cache.
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
    // A navigation away (a list entry, the Fallback link) aborts an import still in flight and
    // the promise rejects on the way out (Firefox, WebKit). That is no World failure. WebKit
    // cancels the fetch before pagehide and before a queued task, so the signal is beforeunload,
    // listened to only while the chunk is in flight (a beforeunload listener keeps a page out of
    // Firefox's back-forward cache; a second of loading is all it costs).
    let unloading = false
    const onNavigation = (): void => {
      unloading = true
    }
    const stopListening = (): void => {
      window.removeEventListener('beforeunload', onNavigation)
    }
    loaderRef.current = createWorldLoader(() => import('../world/World'), {
      loading: () => {
        window.addEventListener('beforeunload', onNavigation)
        store.dispatch({ type: 'world-status', status: 'loading' })
      },
      loaded: (module) => {
        stopListening()
        setWorld(() => module.World)
      },
      failed: (failure) => {
        stopListening()
        if (!unloading) reportFailure(failure)
      },
    })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      stopListening()
      loaderRef.current = null
    }
  }, [store, reportFailure])

  // The preload: the world chunk in an idle callback after the mark, unless a coarse pointer was
  // detected (spec, Architecture). Cancelled on cleanup, so nothing is scheduled twice; the
  // loader imports once anyway. Declared after the mount effect, so the loader exists.
  const preload = shouldPreload(state)
  useEffect(() => {
    if (!preload) return
    return idleScheduler(window)(() => {
      loaderRef.current?.load()
    })
  }, [preload])

  // Entry before any import (a coarse pointer withheld the preload): the chunk loads now.
  const loadOnEntry = shouldLoadOnEntry(state)
  useEffect(() => {
    if (loadOnEntry) loaderRef.current?.load()
  }, [loadOnEntry])

  // Focus rules (plan §5): the World container on entry (AC-5.1, 6.2); the Panel's close control
  // on open (Owner, #30 Q2); the list entry that opened the Panel on close (AC-2.2), found by its
  // href, which the pre-rendered markup already carries. Escape to the Title Screen moves focus
  // nowhere (the spec names no target; the inert World drops it to the body, where Enter and Space
  // reach the key router).
  useEffect(() => {
    const target = focusAfter({ from: previous.current, to: state })
    previous.current = state
    if (target?.target === 'world') worldRef.current?.focus()
    else if (target?.target === 'panel') panelCloseRef.current?.focus()
    else if (target?.target === 'list-entry' && target.exhibitId !== undefined) {
      entriesRef.current
        ?.querySelector<HTMLAnchorElement>(`a[href="/exhibits#${target.exhibitId}"]`)
        ?.focus()
    }
  }, [state])

  const panelExhibit =
    state.panel === null
      ? undefined
      : content.exhibits.find((exhibit) => exhibit.id === state.panel?.exhibitId)

  // `entering` alone is the loading state: the reducer clears it on every path to a ready World
  // (store.test.ts proves the invariant), so no second condition is needed here.
  return (
    <>
      <TitleScreen
        content={content}
        loading={state.entering}
        hidden={state.screen !== 'title'}
        onEnter={() => {
          store.dispatch({ type: 'enter' })
        }}
        onPickExhibit={(exhibitId, event) => {
          // A modified or middle click stays the link's: /exhibits#<id> in a new tab or window.
          if (!isPlainActivation(event)) return
          event.preventDefault()
          store.dispatch({ type: 'open-panel', panel: { exhibitId, opener: 'list' } })
        }}
        entriesRef={entriesRef}
      />
      {panelExhibit !== undefined && (
        <ExhibitPanel
          exhibit={panelExhibit}
          closeRef={panelCloseRef}
          onClose={() => {
            store.dispatch({ type: 'close-panel' })
          }}
        />
      )}
      {World !== null && (
        <World
          paused={selectWorldPaused(state)}
          hidden={state.screen !== 'world'}
          containerRef={worldRef}
          onReady={() => {
            store.dispatch({ type: 'world-status', status: 'ready' })
          }}
          onEvent={(event) => {
            store.dispatch({ type: 'world-event', event })
          }}
          onFailure={reportFailure}
        />
      )}
    </>
  )
}
