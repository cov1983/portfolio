// AC-20.1: the Contact's e-mail link is obfuscated against scraping. Every character of the href,
// `mailto:` included, becomes a decimal character reference; a browser decodes it, a grep for
// `mailto:` over the HTML source does not. Stronger only if scraping becomes a problem (spec).

/** The href of the e-mail anchor, character-reference encoded; for `dangerouslySetInnerHTML`-style islands. */
export function encodeMailto(email: string): string {
  return Array.from(`mailto:${email}`, (char) => `&#${String(char.codePointAt(0))};`).join('')
}
