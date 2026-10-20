import { Component, type ReactNode } from 'react'

import type { WorldFailure } from './types.ts'

// The failure boundary around the World (plan §2, module app; §5 corrected by #33; T8a's
// hand-off on #33): a throw during the World's render, the overlay's caption lookup or the scene
// (React Three Fiber's Canvas rethrows the scene's errors into the nearest parent boundary) is
// caught here instead of unmounting the hydrated root, Title Screen included. The boundary
// reports the typed failure to the app, which logs its one structured line and dispatches
// `world-failure` (AC-22.2: the readable message replaces the World), and renders nothing from
// then on; the app unmounts the World on that state anyway. A class, because React has no hook
// for getDerivedStateFromError. Outside the coverage ratchet (a component): seam 1 proves it with
// the throwing caption lookup (tests/e2e/world-failure.spec.ts).
type Props = { onFailure: (failure: WorldFailure) => void; children: ReactNode }
type State = { failed: boolean }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class FailureBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    this.props.onFailure({ kind: 'render', message: messageOf(error) })
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
