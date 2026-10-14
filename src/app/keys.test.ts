import { describe, expect, it } from 'vitest'

import type { ExhibitId } from '../content/types.ts'
import { isPlainActivation, keyAction, routeKey } from './keys.ts'
import { INITIAL_STATE, type AppState } from './store.ts'

const panel = { exhibitId: 'first' as ExhibitId, opener: 'list' } as const

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...INITIAL_STATE, ...overrides }
}

describe('routeKey', () => {
  it('routes every key to the Panel while one is open, over the Title Screen or the World (AC-12.3, 16.4)', () => {
    expect(routeKey(state({ panel }), false)).toBe('panel')
    expect(routeKey(state({ panel }), true)).toBe('panel')
    expect(routeKey(state({ screen: 'world', worldStatus: 'ready', panel }), false)).toBe('panel')
  })

  it('routes to the Title Screen only when the event target is not a link or button', () => {
    expect(routeKey(state(), false)).toBe('title')
    expect(routeKey(state(), true)).toBe('none')
  })

  it('routes to the World while it is shown, whatever the target', () => {
    expect(routeKey(state({ screen: 'world', worldStatus: 'ready' }), false)).toBe('world')
    expect(routeKey(state({ screen: 'world', worldStatus: 'ready' }), true)).toBe('world')
  })

  it('treats the failure screen like the Title Screen, so Escape still reaches it (AC-22.2)', () => {
    expect(routeKey(state({ screen: 'failed', worldStatus: 'failed' }), false)).toBe('title')
    expect(routeKey(state({ screen: 'failed', worldStatus: 'failed' }), true)).toBe('none')
  })
})

describe('keyAction', () => {
  it('enters the World from the Title Screen on Enter or Space (AC-1.3, 6.2)', () => {
    expect(keyAction('title', 'Enter')).toEqual({ type: 'enter' })
    expect(keyAction('title', 'NumpadEnter')).toEqual({ type: 'enter' })
    expect(keyAction('title', 'Space')).toEqual({ type: 'enter' })
  })

  it('maps Escape on the Title Screen to escape', () => {
    expect(keyAction('title', 'Escape')).toEqual({ type: 'escape' })
  })

  it('closes the Panel on Escape', () => {
    expect(keyAction('panel', 'Escape')).toEqual({ type: 'close-panel' })
  })

  it('maps Escape in the World to escape (AC-6.1)', () => {
    expect(keyAction('world', 'Escape')).toEqual({ type: 'escape' })
  })

  it('yields no action for steering keys and R: they belong to the World input', () => {
    for (const route of ['title', 'panel', 'world'] as const) {
      for (const code of ['ArrowUp', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR']) {
        expect(keyAction(route, code), `${route} ${code}`).toBeNull()
      }
    }
  })

  it('yields no action for Enter or Space inside a Panel or the World', () => {
    expect(keyAction('panel', 'Enter')).toBeNull()
    expect(keyAction('world', 'Space')).toBeNull()
  })

  it('yields no action when the key was not routed', () => {
    expect(keyAction('none', 'Enter')).toBeNull()
    expect(keyAction('none', 'Escape')).toBeNull()
  })
})

describe('isPlainActivation', () => {
  const click = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }

  it('takes a primary click or Enter without modifiers for the Panel', () => {
    expect(isPlainActivation(click)).toBe(true)
  })

  it('leaves a modified or middle click to the link (a new tab or window on /exhibits#<id>)', () => {
    for (const modified of [
      { ...click, button: 1 },
      { ...click, ctrlKey: true },
      { ...click, metaKey: true },
      { ...click, shiftKey: true },
      { ...click, altKey: true },
    ]) {
      expect(isPlainActivation(modified), JSON.stringify(modified)).toBe(false)
    }
  })
})
