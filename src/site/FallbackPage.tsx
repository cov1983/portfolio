import type { Content } from '../content/types.ts'
import { Contact } from './Contact'
import { Exhibit } from './Exhibit'
import './site.css'

// The Fallback Page (spec: Fallback Page; ADR 0004): every Exhibit in full under its own anchor,
// the Bio and the Contact, with a link back to the Title Screen, pre-rendered at build into
// dist/exhibits/index.html and shipped without script (AC-19.1, 19.3, 20.3, 26.4). Landmarks and
// headings for assistive technology (AC-19.2): one h1, an h2 per Exhibit, for the Bio and for the
// Contact, a `nav` to every anchor, one `main`.
type Props = { content: Content }

export function FallbackPage({ content }: Props) {
  return (
    <div className="fallback-page">
      <header>
        <h1>{content.owner.name}</h1>
        <nav aria-label="On this page">
          <ul>
            <li>
              <a href="/">Back to the Title Screen</a>
            </li>
            {content.exhibits.map((exhibit) => (
              <li key={exhibit.id}>
                <a href={`#${exhibit.id}`}>{exhibit.title}</a>
              </li>
            ))}
            <li>
              <a href="#bio">Bio</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        {content.exhibits.map((exhibit) => (
          <Exhibit key={exhibit.id} exhibit={exhibit} />
        ))}
        <section id="bio">
          <h2>Bio</h2>
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.bioHtml }} />
        </section>
        <section id="contact">
          <h2>Contact</h2>
          <Contact contact={content.contact} />
        </section>
      </main>
    </div>
  )
}
