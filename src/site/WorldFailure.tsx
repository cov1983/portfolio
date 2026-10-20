import type { RefObject } from 'react'

import type { AttributedFailure as Failure } from '../app/types.ts'
import { FallbackLink } from './FallbackLink'
import './site.css'

// The readable failure (spec AC-22.2; plan §5, corrected by #33): when the World fails after the
// Visitor entered it, or when Enter meets a World that failed before, this replaces the World:
// a heading by phase (it could not start, or it stopped while the Visitor was in it; Owner on
// #64), one sentence per kind, the Fallback Page link (the Title Screen's text), the Esc line, and a
// "Title Screen" control for a Visitor without an Escape key (a phone), since the Title Screen
// must stay reachable. The technical message stays in the console line src/app/App.tsx logs
// (plan §7, structured, no personal data). The Title Screen's `<main>` carries `hidden` while
// this one shows, so the page has one main landmark. The app focuses this `<main>` on arrival
// (src/app/focus.ts → 'failure'), so a screen reader reads it and Tab reaches the link.
const HEADINGS: Record<Failure['phase'], string> = {
  start: 'The World could not start',
  play: 'The World stopped',
}

const SENTENCES: Record<Failure['kind'], string> = {
  bundle: 'Part of the World did not load.',
  physics: 'The physics engine did not start.',
  webgl: "The browser's 3D graphics (WebGL) are not available.",
  render: 'The World hit an error while drawing.',
}

type Props = {
  failure: Failure
  /** The main element, so the app can focus it on arrival. */
  mainRef: RefObject<HTMLElement | null>
  /** The "Title Screen" control: the same `escape` the key does. */
  onTitleScreen: () => void
}

export function WorldFailure({ failure, mainRef, onTitleScreen }: Props) {
  return (
    <main className="world-failure" tabIndex={-1} ref={mainRef}>
      <h1>{HEADINGS[failure.phase]}</h1>
      <p className="reason">{SENTENCES[failure.kind]}</p>
      <FallbackLink />
      <p className="way-back">
        <button type="button" onClick={onTitleScreen}>
          Title Screen
        </button>
        <span>Esc shows the Title Screen</span>
      </p>
    </main>
  )
}
