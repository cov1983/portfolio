// Focus rules (plan §5; spec, Focus handling): where keyboard focus goes after a state transition.
// Pure: the component that owns the target applies it. T5a applies nothing yet, since no target
// exists before T5b (the World container) and T6 (the Panel); "overlay control activated → world"
// arrives with the overlay (T5b).
import type { ExhibitId } from '../content/types.ts'
import type { AppState } from './store.ts'

export type Focusable = 'world' | 'panel' | 'list-entry'

export type FocusTarget = { target: Focusable; exhibitId?: ExhibitId }

/**
 * Panel opened → into the Panel; Panel closed → its opener, the list entry (AC-2.2) or the World
 * (AC-16.5); entered the World → the World. Everything else moves focus nowhere.
 */
export function focusAfter({ from, to }: { from: AppState; to: AppState }): FocusTarget | null {
  if (to.panel !== null && from.panel === null) return { target: 'panel' }
  if (from.panel !== null && to.panel === null) {
    return from.panel.opener === 'list'
      ? { target: 'list-entry', exhibitId: from.panel.exhibitId }
      : { target: 'world' }
  }
  if (to.screen === 'world' && from.screen !== 'world') return { target: 'world' }
  return null
}
