import { describe, expect, it } from 'vitest'

import { NO_INPUT } from '../model/world'
import { createKeyState, DRIVE_CODES, handlesCode, isDriveCode } from './keyboard'

// AC-7.1 (arrow and letter steer alike), AC-7.2 (physical key position, never the character),
// AC-12.1 (R is Reset): the key state as the scene reads it.
const NONE = NO_INPUT

describe('createKeyState', () => {
  it('reads the physical code, not the character: KeyW with a non-Latin key still steers up', () => {
    const keys = createKeyState()
    const event = { code: 'KeyW', key: 'ц', type: 'keydown' as const }
    keys.onKey(event)
    expect(keys.input).toEqual({ ...NONE, up: true })
  })

  it.each([
    ['up', 'ArrowUp', 'KeyW'],
    ['down', 'ArrowDown', 'KeyS'],
    ['left', 'ArrowLeft', 'KeyA'],
    ['right', 'ArrowRight', 'KeyD'],
  ] as const)('maps the arrow and the letter to the same %s input', (direction, arrow, letter) => {
    const byArrow = createKeyState()
    byArrow.onKey({ code: arrow, type: 'keydown' })
    const byLetter = createKeyState()
    byLetter.onKey({ code: letter, type: 'keydown' })
    expect(byArrow.input).toEqual(byLetter.input)
    expect(byArrow.input[direction]).toBe(true)
  })

  it('lists exactly those codes in DRIVE_CODES', () => {
    expect(DRIVE_CODES).toEqual({
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
    })
  })

  it('releases a direction on keyup', () => {
    const keys = createKeyState()
    keys.onKey({ code: 'ArrowUp', type: 'keydown' })
    keys.onKey({ code: 'ArrowRight', type: 'keydown' })
    keys.onKey({ code: 'ArrowUp', type: 'keyup' })
    expect(keys.input).toEqual({ ...NONE, right: true })
  })

  it('keeps the same input object, so a frame loop can hold a reference to it', () => {
    const keys = createKeyState()
    const { input } = keys
    keys.onKey({ code: 'KeyS', type: 'keydown' })
    expect(input.down).toBe(true)
  })

  it('returns no command for a steering key', () => {
    expect(createKeyState().onKey({ code: 'ArrowLeft', type: 'keydown' })).toBeNull()
  })

  it.each([
    ['KeyR', 'reset'],
    ['Escape', 'escape'],
    ['Enter', 'enter'],
    ['Space', 'enter'],
  ] as const)('returns the command of %s on keydown', (code, command) => {
    expect(createKeyState().onKey({ code, type: 'keydown' })).toBe(command)
  })

  it('returns no command on the keyup of a command key', () => {
    expect(createKeyState().onKey({ code: 'KeyR', type: 'keyup' })).toBeNull()
  })

  it('ignores any other key', () => {
    const keys = createKeyState()
    expect(keys.onKey({ code: 'KeyQ', type: 'keydown' })).toBeNull()
    expect(keys.input).toEqual(NONE)
  })

  it('clear() releases every direction (focus lost)', () => {
    const keys = createKeyState()
    keys.onKey({ code: 'KeyW', type: 'keydown' })
    keys.onKey({ code: 'KeyD', type: 'keydown' })
    keys.clear()
    expect(keys.input).toEqual(NONE)
  })
})

describe('isDriveCode and handlesCode', () => {
  it('tells a steering key from a command key', () => {
    expect(isDriveCode('ArrowUp')).toBe(true)
    expect(isDriveCode('KeyR')).toBe(false)
  })

  it('handles steering keys and commands, nothing else', () => {
    expect(handlesCode('KeyD')).toBe(true)
    expect(handlesCode('Space')).toBe(true)
    expect(handlesCode('KeyQ')).toBe(false)
  })
})
