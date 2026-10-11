// Physical-key state (plan §5, Input): `KeyboardEvent.code` → DriveInput, so the W/A/S/D positions
// steer on every layout (AC-7.2), plus the R, Escape, Enter and Space commands. No three, no Rapier.
import type { DriveInput } from '../model/world'

export const DRIVE_CODES = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
} as const

export type Direction = keyof typeof DRIVE_CODES

/** KeyR · Escape · Enter | Space, reported on keydown. */
export type Command = 'reset' | 'escape' | 'enter'

const COMMAND_CODES: Record<string, Command> = {
  KeyR: 'reset',
  Escape: 'escape',
  Enter: 'enter',
  Space: 'enter',
}

export type KeyEvent = { code: string; type: 'keydown' | 'keyup' }

export type KeyState = {
  /** The keys held right now; the same object for the state's lifetime, so a frame loop can keep it. */
  readonly input: DriveInput
  /** Feeds one event; returns the command it carries, if any. */
  onKey(event: KeyEvent): Command | null
  /** Releases every direction (the window lost focus). */
  clear(): void
}

function directionOf(code: string): Direction | undefined {
  return (Object.keys(DRIVE_CODES) as Direction[]).find((direction) =>
    (DRIVE_CODES[direction] as readonly string[]).includes(code),
  )
}

/** True for a code the World handles, so the page can keep it from scrolling. */
export function handlesCode(code: string): boolean {
  return directionOf(code) !== undefined || code in COMMAND_CODES
}

export function createKeyState(): KeyState {
  const input: DriveInput = { up: false, down: false, left: false, right: false }
  return {
    input,
    onKey(event) {
      const direction = directionOf(event.code)
      if (direction !== undefined) {
        input[direction] = event.type === 'keydown'
        return null
      }
      return event.type === 'keydown' ? (COMMAND_CODES[event.code] ?? null) : null
    },
    clear() {
      input.up = false
      input.down = false
      input.left = false
      input.right = false
    },
  }
}
