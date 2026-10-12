import { describe, expect, it } from 'vitest'

import { encodeMailto } from './mailto'

// AC-20.1's unit half: the Contact's e-mail href carries no readable `mailto:` in the HTML source;
// T4 renders it. A browser decodes the character references, so the anchor still works.
const ADDRESS = 'hello@example.com'

function decodeDecimalReferences(text: string): string {
  return text.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

describe('encodeMailto', () => {
  it('encodes every character of the href as a decimal character reference', () => {
    const encoded = encodeMailto(ADDRESS)
    expect(encoded).toMatch(/^(&#\d+;)+$/)
    expect(decodeDecimalReferences(encoded)).toBe(`mailto:${ADDRESS}`)
  })

  it('has no "mailto:" substring in its output', () => {
    expect(encodeMailto(ADDRESS)).not.toContain('mailto:')
  })
})
