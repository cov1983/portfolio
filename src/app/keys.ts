// Key routing (plan §5; spec, Keys): which owner a key event belongs to, and which app action it
// is. Pure: the DOM listener in src/app/App.tsx reads the target and the code and dispatches what
// comes back. Steering keys and R never become app actions: they are the World input's
// (src/world/input/keyboard.ts) and reach it only when the route is 'world'.
import type { Action, AppState } from './store.ts'

export type KeyRoute = 'panel' | 'title' | 'world' | 'none'

/** The elements whose own key handling wins on the Title Screen (`Element.closest`). */
export const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [contenteditable]'

/**
 * An open Panel owns every key (AC-12.3, 16.4). The Title Screen (and the failure screen, which
 * Escape leaves the same way, AC-22.2) owns a key only when the target is not a link or button,
 * so Enter on a focused list entry follows the link and Enter on the way-in is its click.
 */
export function routeKey(state: AppState, targetIsInteractive: boolean): KeyRoute {
  if (state.panel !== null) return 'panel'
  if (state.screen === 'world') return 'world'
  return targetIsInteractive ? 'none' : 'title'
}

const ENTER_CODES: ReadonlySet<string> = new Set(['Enter', 'NumpadEnter', 'Space'])

/** The app action for a physical key (`KeyboardEvent.code`) on its route, or null. */
export function keyAction(route: KeyRoute, code: string): Action | null {
  switch (route) {
    case 'title':
      if (ENTER_CODES.has(code)) return { type: 'enter' }
      return code === 'Escape' ? { type: 'escape' } : null
    case 'panel':
      return code === 'Escape' ? { type: 'close-panel' } : null
    case 'world':
      return code === 'Escape' ? { type: 'escape' } : null
    case 'none':
      return null
  }
}
