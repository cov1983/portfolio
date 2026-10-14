import { useId, useLayoutEffect, useRef, type RefObject } from 'react'

import type { Exhibit as ExhibitContent } from '../content/types.ts'
import { Exhibit } from './Exhibit'

// The Exhibit Panel (spec: Exhibit Panel, US-16; plan §2, module site): one Exhibit in full, T4's
// Exhibit component in a native modal dialog (Owner, #30 Q1). showModal() puts it in the top layer
// over the Title Screen (and later the World, T7) and makes everything else inert, so Tab and the
// pointer reach the Panel only (AC-16.3); its title names it. Rendered only while the store holds a
// Panel, so the pre-rendered Title Screen never contains it (tests/build/index-html.test.ts). The
// store owns open and closed: Escape reaches the key router (src/app/keys.ts), and the dialog's own
// cancel is turned into the same close, never left to close the element behind React's back.
// The close control comes first, sticks to the top while the Panel scrolls and takes focus on open
// (Owner, #30 Q2; src/app/focus.ts). A backdrop click does not close: the spec asks for Escape and
// the control, and a stray click would lose the reading position.
type Props = {
  exhibit: ExhibitContent
  /** The close control, so the app can focus it on open (plan §5, focusAfter → 'panel'). */
  closeRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function ExhibitPanel({ exhibit, closeRef, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  // Layout effect: the dialog is modal before the app's focus effect runs and before paint.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    dialog.showModal()
    return () => {
      dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className="exhibit-panel"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <button type="button" className="close" ref={closeRef} onClick={onClose}>
        Close
      </button>
      <Exhibit exhibit={exhibit} headingId={headingId} />
    </dialog>
  )
}
