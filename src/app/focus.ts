// Focus rules (plan §5; spec, Focus handling): where keyboard focus goes after a state transition.
// Pure: src/app/App.tsx applies it to the World container (T5b), the Panel's close control and
// the list entry (T6). "Overlay control activated → the World" is not
// a state transition (Reset is the model's, never the store's), so the overlay's handler returns
// focus itself (src/world/World.tsx, AC-12.2). Escape to the Title Screen moves focus nowhere:
// the spec names no target (plan §5, corrected by T5b).
import type { ExhibitId } from '../content/types.ts'
import type { AppState } from './store.ts'

export type Focusable = 'world' | 'panel' | 'list-entry' | 'failure'

export type FocusTarget = { target: Focusable; exhibitId?: ExhibitId }

/**
 * Panel opened → into the Panel; Panel closed → its opener, the list entry (AC-2.2) or the World
 * (AC-16.5), unless the World failed under the Panel, then the failure message that replaced it;
 * entered the World → the World; the readable failure replaced the World → the failure message, so
 * it is read and its link is in reach (AC-22.2, #33). While a Panel is open nothing else moves
 * focus: the page under the modal dialog is inert, so a target there would be lost (ai-review on
 * #64). Everything else moves focus nowhere.
 */
export function focusAfter({ from, to }: { from: AppState; to: AppState }): FocusTarget | null {
  if (to.panel !== null && from.panel === null) return { target: 'panel' }
  if (from.panel !== null && to.panel === null) {
    if (to.screen === 'failed') return { target: 'failure' }
    return from.panel.opener === 'list'
      ? { target: 'list-entry', exhibitId: from.panel.exhibitId }
      : { target: 'world' }
  }
  if (to.panel !== null) return null
  if (to.screen === 'world' && from.screen !== 'world') return { target: 'world' }
  if (to.screen === 'failed' && from.screen !== 'failed') return { target: 'failure' }
  return null
}
