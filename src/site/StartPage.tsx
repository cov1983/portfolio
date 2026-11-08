import type { Content } from '../content/types.ts'
import { Contact } from './Contact'
import { StickyBar } from './StickyBar'
import './site.css'

// /start (spec increment-2: /start, US-5; ADR 0018): how to get in touch and how the Discovery Form
// opens, pre-rendered at build into dist/start/index.html and shipped without script (AC-5.1,
// 5.2). In AC-5.1's order: the Owner's one sentence (content/site.yaml), the Contact, and the
// "Start a project" section. The sentence is the Owner's content; the section's copy lives here
// and is the Owner's text (#102 comment 6721053726). The Contact is the one e-mail link on the
// page, so the section points to it instead of repeating the address (AC-20.1). Landmarks as the
// Fallback Page: one h1, an h2 per section, one `main` (AC-15.2). The sticky bar (StickyBar.tsx,
// spec increment-2 AC-3.1, 3.2) is the way out: its mark leads to the Title Screen, "Exhibits" to
// the Fallback Page, and "Start a project" is marked as this page; it replaced the page's own nav
// (Owner, #103 comment 6723215733).
type Props = { content: Content }

export function StartPage({ content }: Props) {
  return (
    <>
      <StickyBar homeLink current="start" />
      <div className="start-page">
        <header>
          <h1>{content.owner.name}</h1>
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
                A small question or a first idea needs nothing more than an e-mail: use the link
                above and tell me what you have in mind.
              </p>
              <p>
                A larger project starts with the Discovery Form: seven short sections, from why the
                project matters and who it is for to what makes it achievable, about 15 to 20
                minutes to fill in. The form opens only with an Invite, a personal link I send you
                after we have talked. If you would like one, write to me and I will send it.
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
