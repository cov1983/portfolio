import type { Content } from '../content/types.ts'
import { Contact } from './Contact'
import { Mark } from './Mark'
import './site.css'

// /start (spec increment-2: /start, US-5; ADR 0018): how to get in touch and how the Discovery Form
// opens, pre-rendered at build into dist/start/index.html and shipped without script (AC-5.1,
// 5.2). In AC-5.1's order: the Owner's one sentence (content/site.yaml), the Contact, and the
// "Start a project" section. The sentence is the Owner's content; the section's copy lives here
// and is the Owner's text (#102 comment 6721053726). The Contact is the one e-mail link on the
// page, so the section points to it instead of repeating the address (AC-20.1). Landmarks as the
// Fallback Page: one h1, an h2 per section, a `nav` back, one `main` (AC-15.2). The nav is the way
// out until T0b's sticky bar arrives on this page.
type Props = { content: Content }

export function StartPage({ content }: Props) {
  return (
    <div className="start-page">
      <header>
        <div className="flex items-center gap-4">
          <Mark />
          <h1>{content.owner.name}</h1>
        </div>
        <nav aria-label="Site">
          <ul>
            <li>
              <a href="/">Back to the Title Screen</a>
            </li>
            <li>
              <a href="/exhibits">Exhibits</a>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <p className="start-sentence">{content.start.sentence}</p>
        <section id="contact">
          <h2>Contact</h2>
          <Contact contact={content.contact} />
        </section>
        <section id="start-a-project">
          <h2>Start a project</h2>
          {/* Tailwind's preflight zeroes paragraph margins; the space between the two paragraphs is
              the spacing token (--spacing), as the header's gap. */}
          <div className="space-y-4">
            <p>
              A small question or a first idea needs nothing more than an e-mail: use the link above
              and tell me what you have in mind.
            </p>
            <p>
              A larger project starts with the Discovery Form: seven short sections, from why the
              project matters and who it is for to what makes it achievable, about 15 to 20 minutes
              to fill in. The form opens only with an Invite, a personal link I send you after we
              have talked. If you would like one, write to me and I will send it.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
