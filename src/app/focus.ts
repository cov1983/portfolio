// Focus rules (plan §5; spec, Focus handling): where keyboard focus goes after a state transition.
// Pure: the component that owns the target applies it (src/app/App.tsx for the World container
// since T5b; the Panel's targets arrive with T6). "Overlay control activated → the World" is not
// a state transition (Reset is the model's, never the store's), so the overlay's handler returns
// focus itself (src/world/World.tsx, AC-12.2). Escape to the Title Screen moves focus nowhere:
// the spec names no target (plan §5, corrected by T5b).
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
