import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { Content } from '../content/types.ts'
import { markOnce, TITLE_SCREEN_INTERACTIVE_MARK } from '../perf/marks.ts'
import { ExhibitPanel } from '../site/ExhibitPanel'
import { TitleScreen } from '../site/TitleScreen'
import { WorldFailure } from '../site/WorldFailure'
import type { World as WorldComponent } from '../world/World'
import { captionTimer } from './caption.ts'
import { FailureBoundary } from './FailureBoundary'
import { attributeFailure, detectCapability, probeWebgl } from './capability.ts'
import { focusAfter } from './focus.ts'
import { INTERACTIVE_SELECTOR, isPlainActivation, keyAction, routeKey } from './keys.ts'
import {
  createWorldLoader,
  idleScheduler,
  shouldLoadOnEntry,
  shouldPreload,
  type WorldLoader,
} from './preload.ts'
import { selectShownCaption, selectWorldPaused, type Store } from './store.ts'
import type { WorldFailure as Failure } from './types.ts'

// The hydrated root (plan §2, module app; ADR 0010): the one tree both src/entry-prerender.tsx
// renders to a string and src/main.tsx hydrates, so the pre-rendered markup and the first client
// render come from the same component and the same initial state (tests/build/index-html.test.ts
// compares them). The initial state renders the Title Screen alone; the World arrives by dynamic
// import (the entry chunk never imports it, ADR 0010) and mounts paused and hidden behind the
// Title Screen through the store (plan §2, Entry and preload policy), inside the failure boundary
// (FailureBoundary.tsx), so a throw in the World never unmounts the Title Screen. The Exhibit
// Panel renders while the store holds one (T6), so the initial state, and the pre-rendered
// markup, have none.
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
  const failureRef = useRef<HTMLElement>(null)
  const previous = useRef(state)
  const loaderRef = useRef<WorldLoader | null>(null)

  // Structured, no personal data (plan §7): the one console line per failure, which the e2e tests
  // consume through the shared fixture (noted on #33); the store turns it into the readable
  // message (AC-22.2).
  const reportFailure = useCallback(
    (failure: Failure) => {
      const reported = attributeFailure(failure, store.getState())
      console.error('World failed', reported)
      store.dispatch({ type: 'world-failure', failure: reported })
    },
    [store],
  )

  // After the commit that attached the handlers: the Title Screen is interactive (plan §7 line 1),
  // then detection (spec: after hydration; the preload and the Title Screen's hints read it; the
  // WebGL probe takes and releases one context here, after the mark), then the key router and the
  // World loader. StrictMode mounts twice in dev: the mark and the dispatch are
  // idempotent, the listeners are removed in the cleanup, the second loader's import is served
  // from the module cache.
  useEffect(() => {
    markOnce(performance, TITLE_SCREEN_INTERACTIVE_MARK)
    store.dispatch({
      type: 'capability',
      capability: detectCapability(
        (query) => window.matchMedia(query),
        () =>
          probeWebgl(() => {
            // The overloads of getContext narrowed to the one kind the probe asks for.
            const canvas = document.createElement('canvas')
            return { getContext: (id) => canvas.getContext(id) }
          }),
      ),
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
  // href, which the pre-rendered markup already carries; the readable failure when it replaces the
  // World (AC-22.2), or when a Panel closes onto it. Escape to the Title Screen moves focus nowhere
  // (the spec names no target; the inert World drops it to the body, where Enter and Space reach
  // the key router).
  useEffect(() => {
    const target = focusAfter({ from: previous.current, to: state })
    previous.current = state
    if (target?.target === 'world') worldRef.current?.focus()
    else if (target?.target === 'panel') panelCloseRef.current?.focus()
    else if (target?.target === 'failure') failureRef.current?.focus()
    else if (target?.target === 'list-entry' && target.exhibitId !== undefined) {
      entriesRef.current
        ?.querySelector<HTMLAnchorElement>(`a[href="/exhibits#${target.exhibitId}"]`)
        ?.focus()
    }
  }, [state])

  // The Announcer caption's ~5 s run from when it is shown (plan §5, corrected by #32): Escape,
  // the Goal's Panel, a new place and unmount cancel the timer; re-entry starts it again. The
  // expiry names its place, so a timer that fires after a newer caption arrived changes nothing.
  const shownPlace = selectShownCaption(state)?.place
  useEffect(() => {
    if (shownPlace === undefined) return
    return captionTimer(window)(() => {
      store.dispatch({ type: 'caption-expired', place: shownPlace })
    })
  }, [shownPlace, store])

  const panelExhibit =
    state.panel === null
      ? undefined
      : content.exhibits.find((exhibit) => exhibit.id === state.panel?.exhibitId)

  // `entering` alone is the loading state: the reducer clears it on every path to a ready World
  // (store.test.ts proves the invariant), so no second condition is needed here. A failed World
  // is unmounted: the readable message replaces it (AC-22.2), and a lost context or a disposed
  // scene is freed; the failure screen renders from the store's failure.
  return (
    <>
      <TitleScreen
        content={content}
        capability={state.capability}
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
      {state.screen === 'failed' && state.failure !== null && (
        <WorldFailure
          failure={state.failure}
          mainRef={failureRef}
          onTitleScreen={() => {
            store.dispatch({ type: 'escape' })
          }}
        />
      )}
      {World !== null && state.worldStatus !== 'failed' && (
        <FailureBoundary onFailure={reportFailure}>
          <World
            content={content}
            paused={selectWorldPaused(state)}
            hidden={state.screen !== 'world'}
            captionPlace={shownPlace ?? null}
            containerRef={worldRef}
            onReady={() => {
              store.dispatch({ type: 'world-status', status: 'ready' })
            }}
            onEvent={(event) => {
              store.dispatch({ type: 'world-event', event })
            }}
            onFailure={reportFailure}
          />
        </FailureBoundary>
      )}
    </>
  )
}
