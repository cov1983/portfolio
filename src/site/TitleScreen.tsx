import type { MouseEvent, RefObject } from 'react'

import type { Capability } from '../app/store.ts'
import type { Content, ExhibitId } from '../content/types.ts'
import { Contact } from './Contact'
import { FallbackLink } from './FallbackLink'
import { Hero } from './Hero'
import { StickyBar } from './StickyBar'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import './site.css'

// The Title Screen (spec: Title Screen; ADR 0004, ADR 0010): the hero (Hero.tsx: the Owner's name
// and the one line with the edge glow, increment-2 US-2), the Contact line, the way into the
// World, the Exhibit list and the Fallback Page link, pre-rendered at build into dist/index.html
// and usable without script (AC-1.1, 1.2, 2.3), hydrated by
// src/app/App.tsx with this exact markup (T5a). The way-in control changes only after a Visitor's
// action: `loading` is the store's `entering` (AC-4.2), never set before hydration, and the control
// is never disabled (spec: detection and loading never remove the way in). A capability hint
// (AC-21.1, 22.1; #33) is a `data-hint` paragraph at the top, rendered from the store's detection,
// which is null before hydration and in the pre-rendered markup, so none is there (AC-21.2); with
// a hint the Fallback paragraph moves up under it and is the page's first link (constitution 9:
// a hint, never a removed way in). Each list entry links to the Exhibit's anchor on the Fallback Page; after hydration
// `onPickExhibit` gets its activation and the app opens the Exhibit Panel instead for a plain one
// (T6), so the href stays and the markup does not change. `entriesRef` is the list, where the app
// finds the entry to return focus to when the Panel closes (AC-2.2). `away` while the World or the
// readable failure is shown (T0b, plan increment-2 §2, risk 1): the layer around the Title Screen
// takes the state class `away` and `inert`, and site.css makes it `visibility: hidden`, so it leaves
// the tab order and the accessibility tree like the World container does (world.css); unlike the
// `hidden` attribute it replaces, the state transitions: the layer fades and lifts out while the
// World fades in (site.css, increment-2 AC-2.3), instantly under reduced motion (AC-2.4). Escape
// brings it back over the paused World (AC-6.1).
/** A capability hint: what it is about, and the sentence the Visitor reads. */
type Hint = { kind: 'webgl' | 'keyboard'; text: string }

/** The hints a detection calls for, WebGL first (the World cannot run at all), each its own paragraph. */
function hintsFor(capability: Capability | null): Hint[] {
  if (capability === null) return []
  const hints: Hint[] = []
  if (!capability.webgl)
    hints.push({ kind: 'webgl', text: 'The World cannot run here: this browser has no WebGL.' })
  if (capability.coarsePointer)
    hints.push({ kind: 'keyboard', text: 'The World needs a keyboard for now.' })
  return hints
}

type Props = {
  content: Content
  /** What was detected after hydration; null before, and in the pre-rendered markup. */
  capability: Capability | null
  loading: boolean
  away?: boolean
  onEnter: () => void
  onPickExhibit: (id: ExhibitId, event: MouseEvent<HTMLAnchorElement>) => void
  entriesRef: RefObject<HTMLElement | null>
}

export function TitleScreen({
  content,
  capability,
  loading,
  away = false,
  onEnter,
  onPickExhibit,
  entriesRef,
}: Props) {
  const hints = hintsFor(capability)
  return (
    <div className={cn('title-screen-layer', away && 'away')} inert={away}>
      <StickyBar homeLink={false} />
      <main className="title-screen">
        {hints.length > 0 && (
          <>
            {hints.map((hint) => (
              <p key={hint.kind} className="hint" data-hint={hint.kind}>
                {hint.text}
              </p>
            ))}
            <FallbackLink />
          </>
        )}
        <Hero content={content} />
        <Contact contact={content.contact} />
        <Button className="way-in mt-8" onClick={onEnter} aria-busy={loading ? true : undefined}>
          {loading ? 'Loading the World…' : 'Enter the World'}
        </Button>
        <nav className="exhibits" aria-label="Exhibits" ref={entriesRef}>
          <h2>Exhibits</h2>
          <ul>
            {content.exhibits.map((exhibit) => (
              <li key={exhibit.id}>
                <a
                  href={`/exhibits#${exhibit.id}`}
                  onClick={(event) => {
                    onPickExhibit(exhibit.id, event)
                  }}
                >
                  {exhibit.title}
                </a>
                <span className="hook">{exhibit.hook}</span>
              </li>
            ))}
          </ul>
        </nav>
        {hints.length === 0 && <FallbackLink />}
      </main>
    </div>
  )
}
