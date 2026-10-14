// The app state and its reducer (plan §5, Store and key routing; ADR 0009: app state lives in one
// small store, the World model is never React state). Pure: no DOM, no React; src/app/App.tsx reads
// the store with useSyncExternalStore. Three trims of the §5 contract, recorded there (T5a, #28):
// Capability holds the coarse pointer only, the caption holds its place only, routeKey (keys.ts)
// takes no key code.
import type { ExhibitId } from '../content/types.ts'
import type { WorldEvent } from '../world/model/world.ts'
import type { WorldFailure } from './types.ts'

/** What was detected after hydration (AC-21.2). T8a adds reducedMotion, T8b adds webgl. */
export type Capability = { coarsePointer: boolean }

/** An open Exhibit Panel and what opened it, which is where focus returns on close (AC-2.2, 16.5). */
export type PanelRef = { exhibitId: ExhibitId; opener: 'list' | 'goal' }

export type Screen = 'title' | 'world' | 'failed'
export type WorldStatus = 'idle' | 'loading' | 'ready' | 'failed'

export type AppState = {
  screen: Screen
  worldStatus: WorldStatus
  /** The Visitor started entry before the World was ready; the way-in shows loading (AC-4.2). */
  entering: boolean
  panel: PanelRef | null
  /** The Announcer caption on show; its text is the Content's for that place (T8a). */
  caption: { place: 'hub' | ExhibitId } | null
  /** null until detected after hydration. */
  capability: Capability | null
  failure: WorldFailure | null
}

export type Action =
  | { type: 'capability'; capability: Capability }
  | { type: 'world-status'; status: WorldStatus }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'open-panel'; panel: PanelRef }
  | { type: 'close-panel' }
  | { type: 'world-event'; event: WorldEvent }
  | { type: 'world-failure'; failure: WorldFailure }
  | { type: 'caption-expired' }

export const INITIAL_STATE: AppState = {
  screen: 'title',
  worldStatus: 'idle',
  entering: false,
  panel: null,
  caption: null,
  capability: null,
  failure: null,
}

/** The state after `action`; the same object when nothing changes, so subscribers stay quiet. */
export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'capability':
      return { ...state, capability: action.capability }
    case 'world-status':
      if (action.status === 'ready') {
        // Readiness happens once per page load, so it is the Hub caption's once-per-place trigger
        // (AC-5.1, 18.1) the way the model's single zone-entered is the Zone's: the reducer keeps
        // no history. T8a renders the caption and times it from when the World is shown. Entry
        // started while loading switches here, no second press (AC-4.2).
        return {
          ...state,
          worldStatus: 'ready',
          entering: false,
          screen: state.entering ? 'world' : state.screen,
          caption: { place: 'hub' },
        }
      }
      return action.status === state.worldStatus ? state : { ...state, worldStatus: action.status }
    case 'enter':
      // A Panel owns the keys while open; the failure screen is T8b's; inside the World it is a no-op.
      if (state.panel !== null || state.screen !== 'title') return state
      if (state.worldStatus === 'ready') return { ...state, screen: 'world', entering: false }
      return state.entering ? state : { ...state, entering: true }
    case 'escape':
      // Escape closes an open Panel, otherwise shows the Title Screen without Reset (spec, Keys):
      // the World stays as it is, paused by selectWorldPaused (AC-6.1, 6.2).
      if (state.panel !== null) return { ...state, panel: null }
      if (state.screen === 'title') return state
      return { ...state, screen: 'title', entering: false }
    case 'open-panel':
      // Picking an Exhibit to read cancels an entry still waiting for the World (risk 7): it would
      // otherwise switch in under the Panel, and closing would return focus to a hidden entry.
      return { ...state, panel: action.panel, entering: false }
    case 'close-panel':
      return state.panel === null ? state : { ...state, panel: null }
    case 'world-event':
      return reduceWorldEvent(state, action.event)
    case 'world-failure':
      // After entry the readable message replaces the World (AC-22.2); before, the Title Screen stays.
      return {
        ...state,
        failure: action.failure,
        worldStatus: 'failed',
        entering: false,
        screen: state.screen === 'world' ? 'failed' : state.screen,
      }
    case 'caption-expired':
      return state.caption === null ? state : { ...state, caption: null }
  }
}

function reduceWorldEvent(state: AppState, event: WorldEvent): AppState {
  switch (event.type) {
    case 'zone-entered':
      return { ...state, caption: { place: event.zoneId } }
    case 'goal':
      // The Goal opens the Exhibit Panel over the paused World (AC-14.1); the Puck stays in the net.
      return { ...state, panel: { exhibitId: event.zoneId, opener: 'goal' } }
    case 'goal-left':
      return state
  }
}

/** The World steps only while it is shown with no HTML overlay owning the keyboard (AC-6.1, 16.4). */
export const selectWorldPaused = (s: AppState): boolean => s.screen !== 'world' || s.panel !== null

/** The World chunk is imported after hydration unless a coarse pointer was detected (spec, Architecture). */
export const selectWorldPreload = (s: AppState): boolean =>
  s.capability !== null && !s.capability.coarsePointer

// Function-typed properties, not methods: useSyncExternalStore takes them unbound.
export type Store = {
  getState: () => AppState
  dispatch: (action: Action) => void
  /** Called after every change; returns the unsubscribe function (the useSyncExternalStore contract). */
  subscribe: (listener: () => void) => () => void
}

export function createStore(): Store {
  let state = INITIAL_STATE
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action)
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
