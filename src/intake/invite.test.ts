import { describe, expect, it } from 'vitest'

import {
  EMAIL_MAX,
  NAME_MAX,
  checkEmail,
  checkName,
  codePoints,
  decodeInvite,
  encodePayload,
  greetingName,
  isExpired,
  stripCrLf,
  type InvitePayload,
} from './invite'

// The Invite's shared field rules (plan increment-2 §4, §5; ADR 0019), used by the CLI (AC-14.4),
// the page (AC-6.1, AC-6.3) and the function (AC-13.5). An invented Client, never a real one.
const PAYLOAD: InvitePayload = {
  v: 1,
  n: 'Ada Example',
  e: 'ada@example.com',
  l: 'en',
  x: 1_800_000_000,
}
const SIGNATURE = 'c2lnbmF0dXJl' // decodeInvite never checks it; sign.test proves verification

const E_ACUTE_NFD = 'e\u0301' // two code points that NFC composes into one (é)

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function tokenOfJson(json: string): string {
  return `${base64url(new TextEncoder().encode(json))}.${SIGNATURE}`
}

describe('codePoints', () => {
  it('counts a decomposed é as one code point, after NFC', () => {
    expect(codePoints(E_ACUTE_NFD)).toBe(1)
  })

  it('counts an astral character (two UTF-16 units) as one code point', () => {
    expect(codePoints('🏒')).toBe(1)
  })
})

describe('greetingName', () => {
  it('keeps at most the first 80 code points of the NFC form', () => {
    const name = '🏒'.repeat(NAME_MAX) + 'tail'
    expect(greetingName(name)).toBe('🏒'.repeat(NAME_MAX))
  })

  it('returns a short name in its NFC form', () => {
    expect(greetingName(`Ren${E_ACUTE_NFD}`)).toBe('Ren\u00e9')
  })
})

describe('checkName', () => {
  it('accepts a name of exactly 80 code points', () => {
    expect(checkName('a'.repeat(NAME_MAX))).toBe('ok')
  })

  it('refuses a name of 81 code points as too long', () => {
    expect(checkName('a'.repeat(NAME_MAX + 1))).toBe('too-long')
  })

  it('counts after NFC: 80 composed characters typed decomposed (160 code points) are accepted', () => {
    expect(checkName(E_ACUTE_NFD.repeat(NAME_MAX))).toBe('ok')
  })

  it('refuses an empty name', () => {
    expect(checkName('')).toBe('empty')
  })

  it.each([
    ['CR', 'Ada\rExample'],
    ['LF', 'Ada\nExample'],
    ['TAB', 'Ada\tExample'],
    ['U+0085', 'Ada\u0085Example'],
    ['U+2028', 'Ada\u2028Example'],
    ['U+2029', 'Ada\u2029Example'],
    ['a trailing LF', 'Ada Example\n'],
  ])('refuses a name containing %s as a control character', (_, name) => {
    expect(checkName(name)).toBe('control')
  })

  it.each([
    ['a trailing space', 'Ada Example '],
    ['a leading space', ' Ada Example'],
    ['a trailing no-break space', 'Ada Example\u00a0'],
    ['only spaces', '   '],
  ])('refuses a name with %s as edge whitespace, never trimmed', (_, name) => {
    expect(checkName(name)).toBe('edge-space')
  })

  it('accepts inner spaces', () => {
    expect(checkName('Ada  Lovelace Example')).toBe('ok')
  })
})

describe('checkEmail', () => {
  it('accepts one address', () => {
    expect(checkEmail('ada@example.com')).toBe('ok')
  })

  it.each([
    ['two addresses with a comma', 'ada@example.com, bob@example.com'],
    ['two addresses with a space', 'ada@example.com bob@example.com'],
    ['two addresses with a semicolon', 'ada@example.com;bob@example.com'],
    ['two at signs', 'ada@bob@example.com'],
    ['no at sign', 'ada.example.com'],
    ['an empty local part', '@example.com'],
    ['an empty domain', 'ada@'],
    ['a display-name form', 'Ada <ada@example.com>'],
    ['a quoted local part', '"ada"@example.com'],
    ['a comment', 'ada(x)@example.com'],
    ['CR', 'ada@example.com\rBcc: x@example.com'],
    ['LF', 'ada@example.com\nBcc: x@example.com'],
    ['U+0085', 'ada@exa\u0085mple.com'],
    ['U+2028', 'ada@exa\u2028mple.com'],
    ['an empty string', ''],
  ])('refuses %s as invalid', (_, email) => {
    expect(checkEmail(email)).toBe('invalid')
  })

  it('accepts an address of exactly 254 code points', () => {
    const email = `ada@${'a'.repeat(EMAIL_MAX - 4)}`
    expect(checkEmail(email)).toBe('ok')
  })

  it('refuses an address of 255 code points', () => {
    const email = `ada@${'a'.repeat(EMAIL_MAX - 3)}`
    expect(checkEmail(email)).toBe('invalid')
  })

  it.each([
    ['a trailing space', 'ada@example.com '],
    ['a leading space', ' ada@example.com'],
    ['a trailing LF', 'ada@example.com\n'],
  ])('refuses an address with %s as edge whitespace, never trimmed', (_, email) => {
    expect(checkEmail(email)).toBe('edge-space')
  })
})

describe('stripCrLf', () => {
  it('removes every CR and LF and nothing else', () => {
    expect(stripCrLf('Ada\r\nBcc: x\n\u2028y\r')).toBe('AdaBcc: x\u2028y')
  })
})

describe('decodeInvite', () => {
  it('reads back the payload of an encoded Invite with its two parts', () => {
    const payloadPart = encodePayload(PAYLOAD)
    expect(decodeInvite(`${payloadPart}.${SIGNATURE}`)).toEqual({
      kind: 'readable',
      payload: PAYLOAD,
      payloadPart,
      signature: SIGNATURE,
    })
  })

  it('round-trips a non-ASCII name through UTF-8', () => {
    const payload = { ...PAYLOAD, n: 'Zoë Ølsen 🏒' }
    const decoded = decodeInvite(`${encodePayload(payload)}.${SIGNATURE}`)
    expect(decoded).toMatchObject({ kind: 'readable', payload })
  })

  it('drops fields the payload does not define', () => {
    const decoded = decodeInvite(tokenOfJson(JSON.stringify({ ...PAYLOAD, extra: 'x' })))
    expect(decoded).toMatchObject({ kind: 'readable', payload: PAYLOAD })
  })

  it.each([
    ['one part', encodePayload(PAYLOAD)],
    ['three parts', `${encodePayload(PAYLOAD)}.${SIGNATURE}.${SIGNATURE}`],
    ['an empty payload part', `.${SIGNATURE}`],
    ['an empty signature part', `${encodePayload(PAYLOAD)}.`],
    ['a character outside base64url', `${encodePayload(PAYLOAD)}+.${SIGNATURE}`],
    ['a payload length of 1 mod 4', `${encodePayload(PAYLOAD).slice(0, 5)}.${SIGNATURE}`],
    ['bytes that are not UTF-8', `${base64url(new Uint8Array([0xff, 0xfe, 0x7b]))}.${SIGNATURE}`],
    ['text that is not JSON', tokenOfJson('{"v":1,')],
    ['JSON that is not an object', tokenOfJson('[1]')],
    ['JSON null', tokenOfJson('null')],
  ])('is unreadable with %s', (_, token) => {
    expect(decodeInvite(token)).toEqual({ kind: 'unreadable' })
  })

  it.each([
    ['v is not 1', { ...PAYLOAD, v: 2 }],
    ['n is missing', { ...PAYLOAD, n: undefined }],
    ['n is not a string', { ...PAYLOAD, n: 42 }],
    ['e is not a string', { ...PAYLOAD, e: ['ada@example.com'] }],
    ['l is not en', { ...PAYLOAD, l: 'de' }],
    ['x is a string', { ...PAYLOAD, x: '1800000000' }],
    ['x is not an integer', { ...PAYLOAD, x: 1.5 }],
    ['x is not positive', { ...PAYLOAD, x: 0 }],
    ['x is beyond the safe integers', { ...PAYLOAD, x: 2 ** 53 }],
  ])('is unreadable when %s', (_, fields) => {
    expect(decodeInvite(tokenOfJson(JSON.stringify(fields)))).toEqual({ kind: 'unreadable' })
  })
})

describe('isExpired', () => {
  it('is valid one second before x', () => {
    expect(isExpired(PAYLOAD, PAYLOAD.x - 1)).toBe(false)
  })

  it('is expired at x', () => {
    expect(isExpired(PAYLOAD, PAYLOAD.x)).toBe(true)
  })

  it('is expired after x', () => {
    expect(isExpired(PAYLOAD, PAYLOAD.x + 1)).toBe(true)
  })
})
