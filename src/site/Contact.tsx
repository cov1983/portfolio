import type { Content } from '../content/types.ts'

// The Contact line (spec: Contact; AC-20.1, 20.2, 20.3): the GitHub profile in a new tab and the
// e-mail link. The e-mail href is already character-reference encoded by the content loader; a
// React `href` prop would re-escape its ampersands, so the anchor is a static HTML island that
// hydration never compares (ADR 0010). Rendered on the Title Screen and the Fallback Page.
type Props = { contact: Content['contact'] }

export function Contact({ contact }: Props) {
  return (
    <p className="contact">
      <a href={contact.github} target="_blank" rel="noopener">
        GitHub
      </a>
      {' · '}
      <span
        dangerouslySetInnerHTML={{ __html: `<a href="${contact.emailHrefEntities}">E-mail</a>` }}
      />
    </p>
  )
}
