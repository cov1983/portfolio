import { describe, expect, it } from 'vitest'

import type { ExhibitId } from '../content/types.ts'
import {
  createStore,
  INITIAL_STATE,
  reduce,
  selectShownCaption,
  selectWorldPaused,
  selectWorldPreload,
  type AppState,
} from './store.ts'

const first = 'first' as ExhibitId
const panelFromList = { exhibitId: first, opener: 'list' } as const
const panelFromGoal = { exhibitId: first, opener: 'goal' } as const
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
    const capability = { coarsePointer: true, webgl: true }
    const next = reduce(state(), { type: 'capability', capability })
    expect(next.capability).toEqual(capability)
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

  it('sets the Hub caption when the World becomes ready, entering or not (AC-5.1 caption state)', () => {
    const ready = { type: 'world-status', status: 'ready' } as const
    expect(reduce(state({ worldStatus: 'loading' }), ready).caption).toEqual({ place: 'hub' })
    expect(reduce(state({ worldStatus: 'loading', entering: true }), ready).caption).toEqual({
      place: 'hub',
    })
  })

  it('sets no caption on the other status changes', () => {
    expect(reduce(state(), { type: 'world-status', status: 'loading' }).caption).toBeNull()
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

  it('shows the failure screen on enter when the World failed before entry (AC-22.2; T5a hand-off on #33)', () => {
    const next = reduce(state({ worldStatus: 'failed', failure }), { type: 'enter' })
    expect(next).toMatchObject({ screen: 'failed', entering: false, failure })
  })

  it('ignores enter while a Panel is open over a failed World', () => {
    const before = state({ worldStatus: 'failed', failure, panel: panelFromList })
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

  it('leaves the caption alone on escape and on the resuming enter (AC-6.2: no Reset, nothing replayed)', () => {
    const inWorld = state({ screen: 'world', worldStatus: 'ready', caption: { place: 'hub' } })
    const onTitle = reduce(inWorld, { type: 'escape' })
    expect(onTitle.caption).toEqual({ place: 'hub' })
    expect(reduce(onTitle, { type: 'enter' })).toMatchObject({
      screen: 'world',
      caption: { place: 'hub' },
    })
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

  it('cancels a pending entry when a Panel opens, so the World does not switch in under it', () => {
    const entering = state({ worldStatus: 'loading', entering: true })
    const reading = reduce(entering, { type: 'open-panel', panel: panelFromList })
    expect(reduce(reading, { type: 'world-status', status: 'ready' })).toMatchObject({
      screen: 'title',
      entering: false,
    })
  })

  it('closes the Panel', () => {
    expect(reduce(state({ panel: panelFromList }), { type: 'close-panel' }).panel).toBeNull()
  })

  it('closes a Panel the Goal opened back into the running World (AC-14.2, 16.5)', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready', panel: panelFromGoal }), {
      type: 'close-panel',
    })
    expect([next.screen, next.panel, selectWorldPaused(next)]).toEqual(['world', null, false])
  })

  it('closes only the Panel on escape over the World, never shows the Title Screen (AC-16.5)', () => {
    const next = reduce(state({ screen: 'world', worldStatus: 'ready', panel: panelFromGoal }), {
      type: 'escape',
    })
    expect([next.screen, next.panel]).toEqual(['world', null])
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

  it('shows the failure screen when the World fails while the Visitor is entering (AC-22.2; T5a hand-off on #33)', () => {
    const next = reduce(state({ worldStatus: 'loading', entering: true }), {
      type: 'world-failure',
      failure,
    })
    expect(next).toMatchObject({
      screen: 'failed',
      worldStatus: 'failed',
      entering: false,
      failure,
    })
  })

  it('keeps the Title Screen when the World fails before entry, the failure waiting for Enter', () => {
    const next = reduce(state({ worldStatus: 'loading' }), { type: 'world-failure', failure })
    expect(next).toMatchObject({ screen: 'title', worldStatus: 'failed', failure })
  })

  it('keeps the first failure when a second one is reported', () => {
    const before = state({ screen: 'failed', worldStatus: 'failed', failure })
    const second = { kind: 'physics', message: 'wasm refused' } as const
    expect(reduce(before, { type: 'world-failure', failure: second })).toBe(before)
  })

  it('clears the caption when it expires', () => {
    const shown = state({ caption: { place: 'hub' } })
    expect(reduce(shown, { type: 'caption-expired', place: 'hub' }).caption).toBeNull()
  })

  it('keeps a newer caption when the expiry was timed for another place', () => {
    const zone = state({ screen: 'world', worldStatus: 'ready', caption: { place: first } })
    expect(reduce(zone, { type: 'caption-expired', place: 'hub' })).toBe(zone)
  })

  it('clears the caption when the Goal opens the Panel (spec: a caption disappears when a Panel opens)', () => {
    const next = reduce(
      state({ screen: 'world', worldStatus: 'ready', caption: { place: first } }),
      { type: 'world-event', event: { type: 'goal', zoneId: first } },
    )
    expect(next.caption).toBeNull()
  })

  it('keeps the pending Hub caption when a Panel opens from the Title Screen list (AC-5.1)', () => {
    const ready = state({ worldStatus: 'ready', caption: { place: 'hub' } })
    const read = reduce(reduce(ready, { type: 'open-panel', panel: panelFromList }), {
      type: 'close-panel',
    })
    expect(reduce(read, { type: 'enter' })).toMatchObject({
      screen: 'world',
      caption: { place: 'hub' },
    })
  })

  it('returns the same state object when an action changes nothing', () => {
    const before = state()
    expect(reduce(before, { type: 'caption-expired', place: 'hub' })).toBe(before)
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

describe('selectShownCaption', () => {
  const due = { caption: { place: 'hub' }, worldStatus: 'ready' } as const

  it('shows the caption due while the World is shown without a Panel (AC-5.1)', () => {
    expect(selectShownCaption(state({ ...due, screen: 'world' }))).toEqual({ place: 'hub' })
  })

  it('shows none behind the Title Screen, where readiness usually sets it', () => {
    expect(selectShownCaption(state(due))).toBeNull()
  })

  it('shows none while a Panel is open over the World', () => {
    expect(selectShownCaption(state({ ...due, screen: 'world', panel: panelFromGoal }))).toBeNull()
  })
})

describe('selectWorldPreload', () => {
  it('does not preload before the capability is known', () => {
    expect(selectWorldPreload(state())).toBe(false)
  })

  it('does not preload on a coarse pointer (spec: no preload after a coarse pointer is detected)', () => {
    expect(selectWorldPreload(state({ capability: { coarsePointer: true, webgl: true } }))).toBe(
      false,
    )
  })

  it('does not preload without WebGL (Owner, #33 Q5: the browser cannot use the chunk)', () => {
    expect(selectWorldPreload(state({ capability: { coarsePointer: false, webgl: false } }))).toBe(
      false,
    )
  })

  it('preloads on a fine pointer with WebGL', () => {
    expect(selectWorldPreload(state({ capability: { coarsePointer: false, webgl: true } }))).toBe(
      true,
    )
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
    store.dispatch({ type: 'caption-expired', place: 'hub' })
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
