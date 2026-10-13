import { describe, expect, it } from 'vitest'

import type { ExhibitId } from '../content/types.ts'
import {
  createStore,
  INITIAL_STATE,
  reduce,
  selectWorldPaused,
  selectWorldPreload,
  type AppState,
} from './store.ts'

const first = 'first' as ExhibitId
const panelFromList = { exhibitId: first, opener: 'list' } as const
const failure = { kind: 'bundle', message: 'chunk failed' } as const

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...INITIAL_STATE, ...overrides }
}

describe('reduce', () => {
  it('starts on the Title Screen with nothing loaded, detected or open', () => {
    expect(INITIAL_STATE).toEqual({
      screen: 'title',
      worldStatus: 'idle',
      entering: false,
      panel: null,
      caption: null,
      capability: null,
      failure: null,
    })
  })

  it('records the capability detected after hydration', () => {
    const next = reduce(state(), { type: 'capability', capability: { coarsePointer: true } })
    expect(next.capability).toEqual({ coarsePointer: true })
  })

  it('records the World status', () => {
    expect(reduce(state(), { type: 'world-status', status: 'loading' }).worldStatus).toBe('loading')
  })

  it('enters the World when it becomes ready while the Visitor is entering (AC-4.2)', () => {
    const next = reduce(state({ worldStatus: 'loading', entering: true }), {
      type: 'world-status',
      status: 'ready',
    })
    expect(next).toMatchObject({ screen: 'world', worldStatus: 'ready', entering: false })
  })

  it('stays on the Title Screen when the World becomes ready without the Visitor entering', () => {
    const next = reduce(state({ worldStatus: 'loading' }), {
      type: 'world-status',
      status: 'ready',
    })
    expect(next).toMatchObject({ screen: 'title', worldStatus: 'ready' })
  })

  it('enters the World at once when it is ready', () => {
    const next = reduce(state({ worldStatus: 'ready' }), { type: 'enter' })
    expect(next).toMatchObject({ screen: 'world', entering: false })
  })

  it('marks the Visitor as entering while the World is not ready (the way-in shows loading)', () => {
    expect(reduce(state({ worldStatus: 'idle' }), { type: 'enter' })).toMatchObject({
      screen: 'title',
      entering: true,
    })
    expect(reduce(state({ worldStatus: 'loading' }), { type: 'enter' })).toMatchObject({
      screen: 'title',
      entering: true,
    })
  })

  it('ignores a second enter while already entering', () => {
    const before = state({ worldStatus: 'loading', entering: true })
    expect(reduce(before, { type: 'enter' })).toBe(before)
  })

  it('ignores enter while a Panel is open', () => {
    const before = state({ worldStatus: 'ready', panel: panelFromList })
    expect(reduce(before, { type: 'enter' })).toBe(before)
  })

  it('ignores enter on the failure screen', () => {
    const before = state({ screen: 'failed', worldStatus: 'failed', failure })
    expect(reduce(before, { type: 'enter' })).toBe(before)
  })

  it('ignores enter inside the World', () => {
    const before = state({ screen: 'world', worldStatus: 'ready' })
    expect(reduce(before, { type: 'enter' })).toBe(before)
  })

  it('closes an open Panel on escape before anything else', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready', panel: panelFromList }), {
      type: 'escape',
    })
    expect(next).toMatchObject({ screen: 'world', panel: null })
  })

  it('shows the Title Screen over the World on escape; the World keeps its state (AC-6.1, 6.2)', () => {
    // No reset exists in Action: the model is untouched, selectWorldPaused pauses it.
    const next = reduce(state({ screen: 'world', worldStatus: 'ready' }), { type: 'escape' })
    expect(next).toMatchObject({ screen: 'title', worldStatus: 'ready' })
  })

  it('returns from the failure screen to the Title Screen on escape (AC-22.2)', () => {
    const next = reduce(state({ screen: 'failed', worldStatus: 'failed', failure }), {
      type: 'escape',
    })
    expect(next).toMatchObject({ screen: 'title', failure })
  })

  it('changes nothing on escape on the Title Screen without a Panel', () => {
    const before = state({ entering: true })
    expect(reduce(before, { type: 'escape' })).toBe(before)
  })

  it('opens a Panel', () => {
    expect(reduce(state(), { type: 'open-panel', panel: panelFromList }).panel).toEqual(
      panelFromList,
    )
  })

  it('closes the Panel', () => {
    expect(reduce(state({ panel: panelFromList }), { type: 'close-panel' }).panel).toBeNull()
  })

  it('sets the caption place when the Puck first enters a Zone (AC-13.1)', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready' }), {
      type: 'world-event',
      event: { type: 'zone-entered', zoneId: first },
    })
    expect(next.caption).toEqual({ place: first })
  })

  it('opens the Panel from the Goal, which pauses the World (AC-14.1)', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready' }), {
      type: 'world-event',
      event: { type: 'goal', zoneId: first },
    })
    expect(next.panel).toEqual({ exhibitId: first, opener: 'goal' })
    expect(selectWorldPaused(next)).toBe(true)
  })

  it('changes nothing when the Puck leaves the Goal', () => {
    const before = state({ screen: 'world', worldStatus: 'ready' })
    expect(
      reduce(before, { type: 'world-event', event: { type: 'goal-left', zoneId: first } }),
    ).toBe(before)
  })

  it('shows the failure screen when the World fails after entry (AC-22.2)', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready' }), {
      type: 'world-failure',
      failure,
    })
    expect(next).toMatchObject({ screen: 'failed', worldStatus: 'failed', failure })
  })

  it('keeps the Title Screen when the World fails before entry', () => {
    const next = reduce(state({ worldStatus: 'loading', entering: true }), {
      type: 'world-failure',
      failure,
    })
    expect(next).toMatchObject({ screen: 'title', worldStatus: 'failed', entering: false, failure })
  })

  it('clears the caption when it expires', () => {
    const shown = state({ caption: { place: 'hub' } })
    expect(reduce(shown, { type: 'caption-expired' }).caption).toBeNull()
  })

  it('returns the same state object when an action changes nothing', () => {
    const before = state()
    expect(reduce(before, { type: 'caption-expired' })).toBe(before)
    expect(reduce(before, { type: 'close-panel' })).toBe(before)
    expect(reduce(before, { type: 'world-status', status: 'idle' })).toBe(before)
  })
})

describe('selectWorldPaused', () => {
  it('pauses the World while the Title Screen is shown', () => {
    expect(selectWorldPaused(state({ worldStatus: 'ready' }))).toBe(true)
  })

  it('pauses the World while a Panel is open over it (AC-16.4)', () => {
    expect(
      selectWorldPaused(state({ screen: 'world', worldStatus: 'ready', panel: panelFromList })),
    ).toBe(true)
  })

  it('runs the World when it is shown without a Panel', () => {
    expect(selectWorldPaused(state({ screen: 'world', worldStatus: 'ready' }))).toBe(false)
  })
})

describe('selectWorldPreload', () => {
  it('does not preload before the capability is known', () => {
    expect(selectWorldPreload(state())).toBe(false)
  })

  it('does not preload on a coarse pointer (spec: no preload after a coarse pointer is detected)', () => {
    expect(selectWorldPreload(state({ capability: { coarsePointer: true } }))).toBe(false)
  })

  it('preloads on a fine pointer', () => {
    expect(selectWorldPreload(state({ capability: { coarsePointer: false } }))).toBe(true)
  })
})

describe('createStore', () => {
  it('starts from the initial state', () => {
    expect(createStore().getState()).toEqual(INITIAL_STATE)
  })

  it('reduces dispatched actions', () => {
    const store = createStore()
    store.dispatch({ type: 'enter' })
    expect(store.getState().entering).toBe(true)
  })

  it('notifies subscribers on a change only', () => {
    const store = createStore()
    let calls = 0
    store.subscribe(() => {
      calls += 1
    })
    store.dispatch({ type: 'caption-expired' })
    store.dispatch({ type: 'enter' })
    expect(calls).toBe(1)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })
    unsubscribe()
    store.dispatch({ type: 'enter' })
    expect(calls).toBe(0)
  })

  it('never leaves entering set once the World is ready, so the way-in reads entering alone', () => {
    const entering = state({ worldStatus: 'loading', entering: true })
    expect(reduce(entering, { type: 'world-status', status: 'ready' }).entering).toBe(false)
    expect(reduce(state({ worldStatus: 'ready' }), { type: 'enter' }).entering).toBe(false)
    expect(reduce(entering, { type: 'world-failure', failure }).entering).toBe(false)
  })
})
