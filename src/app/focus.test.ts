import { describe, expect, it } from 'vitest'

import type { ExhibitId } from '../content/types.ts'
import { focusAfter } from './focus.ts'
import { INITIAL_STATE, type AppState } from './store.ts'

const first = 'first' as ExhibitId

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...INITIAL_STATE, ...overrides }
}

describe('focusAfter', () => {
  it('moves focus into a Panel that opened', () => {
    const from = state()
    const to = state({ panel: { exhibitId: first, opener: 'list' } })
    expect(focusAfter({ from, to })).toEqual({ target: 'panel' })
  })

  it('returns focus to the list entry that opened the Panel (AC-2.2)', () => {
    const from = state({ panel: { exhibitId: first, opener: 'list' } })
    const to = state()
    expect(focusAfter({ from, to })).toEqual({ target: 'list-entry', exhibitId: first })
  })

  it('returns focus to the World when a Panel the Goal opened closes (AC-16.5)', () => {
    const from = state({
      screen: 'world',
      worldStatus: 'ready',
      panel: { exhibitId: first, opener: 'goal' },
    })
    const to = state({ screen: 'world', worldStatus: 'ready' })
    expect(focusAfter({ from, to })).toEqual({ target: 'world' })
  })

  it('gives the World focus on entry', () => {
    const from = state({ worldStatus: 'ready' })
    const to = state({ screen: 'world', worldStatus: 'ready' })
    expect(focusAfter({ from, to })).toEqual({ target: 'world' })
  })

  it('moves focus to the readable failure that replaced the World (AC-22.2)', () => {
    const failure = { kind: 'bundle', message: 'chunk failed', phase: 'start' } as const
    const from = state({ screen: 'world', worldStatus: 'ready' })
    const to = state({ screen: 'failed', worldStatus: 'failed', failure })
    expect(focusAfter({ from, to })).toEqual({ target: 'failure' })
  })

  it('moves focus to the readable failure when Enter meets a World that failed before', () => {
    const failure = { kind: 'bundle', message: 'chunk failed', phase: 'start' } as const
    const from = state({ worldStatus: 'failed', failure })
    const to = state({ screen: 'failed', worldStatus: 'failed', failure })
    expect(focusAfter({ from, to })).toEqual({ target: 'failure' })
  })

  it('moves nothing while a Panel is open, where the World fails under it (ai-review on #64)', () => {
    const failure = { kind: 'webgl', message: 'the WebGL context was lost', phase: 'play' } as const
    const panel = { exhibitId: first, opener: 'goal' } as const
    const from = state({ screen: 'world', worldStatus: 'ready', panel })
    const to = state({ screen: 'failed', worldStatus: 'failed', failure, panel })
    expect(focusAfter({ from, to })).toBeNull()
  })

  it('moves focus to the readable failure when the Panel closes onto it, not the unmounted World', () => {
    const failure = { kind: 'webgl', message: 'the WebGL context was lost', phase: 'play' } as const
    const panel = { exhibitId: first, opener: 'goal' } as const
    const from = state({ screen: 'failed', worldStatus: 'failed', failure, panel })
    const to = state({ screen: 'failed', worldStatus: 'failed', failure })
    expect(focusAfter({ from, to })).toEqual({ target: 'failure' })
  })

  it('moves nothing when the screen and the Panel are unchanged', () => {
    const from = state({ screen: 'world', worldStatus: 'ready' })
    const to = state({ screen: 'world', worldStatus: 'ready', caption: { place: 'hub' } })
    expect(focusAfter({ from, to })).toBeNull()
  })

  it('moves nothing when the Title Screen is shown over the World', () => {
    const from = state({ screen: 'world', worldStatus: 'ready' })
    const to = state({ worldStatus: 'ready' })
    expect(focusAfter({ from, to })).toBeNull()
  })
})
