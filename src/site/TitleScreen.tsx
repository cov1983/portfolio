import type { Content } from '../content/types.ts'
import { Contact } from './Contact'
import './site.css'

// The static Title Screen (spec: Title Screen; ADR 0004, ADR 0010): the Owner's name, the one
// line, the Contact line, the way into the World, the Exhibit list and the Fallback Page link,
// pre-rendered at build into dist/index.html and usable without script (AC-1.1, 1.2, 2.3). T5a
// hydrates this exact markup: the way-in control is inert until then, and a capability hint
// (AC-21.1, 22.1; T8b) is an element with `data-hint` added after hydration only, so none is here
// (AC-21.2). Each list entry links to the Exhibit's anchor on the Fallback Page; T6 opens the
// Exhibit Panel on activation instead and keeps the href.
type Props = { content: Content }

export function TitleScreen({ content }: Props) {
  return (
    <main className="title-screen">
      <header>
        <h1>{content.owner.name}</h1>
        <p className="one-line">{content.oneLine}</p>
      </header>
      <Contact contact={content.contact} />
      <button type="button" className="way-in">
        Enter the World
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
