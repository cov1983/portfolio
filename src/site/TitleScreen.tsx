import type { Content } from '../content/types.ts'
import { Contact } from './Contact'
import './site.css'

// The Title Screen (spec: Title Screen; ADR 0004, ADR 0010): the Owner's name, the one line, the
// Contact line, the way into the World, the Exhibit list and the Fallback Page link, pre-rendered
// at build into dist/index.html and usable without script (AC-1.1, 1.2, 2.3), hydrated by
// src/app/App.tsx with this exact markup (T5a). The way-in control changes only after a Visitor's
// action: `loading` is the store's `entering` (AC-4.2), never set before hydration, and the control
// is never disabled (spec: detection and loading never remove the way in). A capability hint
// (AC-21.1, 22.1; T8b) is an element with `data-hint` added after hydration only, so none is here
// (AC-21.2). Each list entry links to the Exhibit's anchor on the Fallback Page; T6 opens the
// Exhibit Panel on activation instead and keeps the href. `hidden` while the World is shown
// (T5b): the `hidden` attribute, so the Title Screen leaves the tab order and the accessibility
// tree; Escape brings it back over the paused World (AC-6.1).
type Props = { content: Content; loading: boolean; hidden?: boolean; onEnter: () => void }

export function TitleScreen({ content, loading, hidden = false, onEnter }: Props) {
  return (
    <main className="title-screen" hidden={hidden}>
      <header>
        <h1>{content.owner.name}</h1>
        <p className="one-line">{content.oneLine}</p>
      </header>
      <Contact contact={content.contact} />
      <button
        type="button"
        className="way-in"
        onClick={onEnter}
        aria-busy={loading ? true : undefined}
      >
        {loading ? 'Loading the World…' : 'Enter the World'}
      </button>
      <nav className="exhibits" aria-label="Exhibits">
        <h2>Exhibits</h2>
        <ul>
          {content.exhibits.map((exhibit) => (
            <li key={exhibit.id}>
              <a href={`/exhibits#${exhibit.id}`}>{exhibit.title}</a>
              <span className="hook">{exhibit.hook}</span>
            </li>
          ))}
        </ul>
      </nav>
      <p className="fallback">
        <a href="/exhibits">Every Exhibit, the Bio and the Contact as a plain page</a>
      </p>
    </main>
  )
}
