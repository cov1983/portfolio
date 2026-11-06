import { Buffer } from 'node:buffer'
import { createHmac, randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { encodePayload, type InvitePayload } from '../invite.ts'
import { signInvite, verifyInvite } from './sign.ts'

// The Invite's signing half (plan increment-2 §4, §5; ADR 0019): HMAC-SHA256 over the payload's
// base64url text, verified by comparing the signature *strings* in constant time, never the decoded
// bytes (base64url's spare bits; ai-review round 3 on #96). The secret is drawn at run time, never
// a committed literal, and the Client is invented.
const SECRET = randomBytes(32).toString('base64url')
const NOW = 1_800_000_000
const PAYLOAD: InvitePayload = {
  v: 1,
  n: 'Ada Example',
  e: 'ada@example.com',
  l: 'en',
  x: NOW + 30 * 86_400,
}

function parts(token: string): [string, string] {
  const [payloadPart = '', signature = ''] = token.split('.')
  return [payloadPart, signature]
}

// The token format of plan §4, written out independently of sign.ts, so a payload sign.ts would
// never produce (bad fields) can still carry a valid signature.
function signedToken(json: string): string {
  const payloadPart = Buffer.from(json, 'utf8').toString('base64url')
  const signature = createHmac('sha256', SECRET).update(payloadPart).digest('base64url')
  return `${payloadPart}.${signature}`
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function alphabetIndex(char: string): number {
  return ALPHABET.indexOf(char)
}

function charAt(index: number): string {
  return ALPHABET.charAt(index)
}

describe('signInvite', () => {
  it('produces the payload part and a 43-character signature (32 bytes in base64url)', () => {
    const [payloadPart, signature] = parts(signInvite(PAYLOAD, SECRET))
    expect(payloadPart).toBe(encodePayload(PAYLOAD))
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('matches the format of plan §4 computed independently', () => {
    expect(signInvite(PAYLOAD, SECRET)).toBe(signedToken(JSON.stringify(PAYLOAD)))
  })
})

describe('verifyInvite', () => {
  it('accepts a token it signed, before its expiry', () => {
    expect(verifyInvite(signInvite(PAYLOAD, SECRET), SECRET, NOW)).toEqual({
      ok: true,
      payload: PAYLOAD,
    })
  })

  it('rejects a tampered payload that keeps the original signature', () => {
    const [, signature] = parts(signInvite(PAYLOAD, SECRET))
    const tampered = `${encodePayload({ ...PAYLOAD, e: 'mallory@example.com' })}.${signature}`
    expect(verifyInvite(tampered, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' })
  })

  it('rejects a signature flip that changes the decoded bytes', () => {
    const [payloadPart, signature] = parts(signInvite(PAYLOAD, SECRET))
    const flipped = charAt(alphabetIndex(signature.charAt(0)) ^ 0b100000) + signature.slice(1)
    expect(Buffer.from(flipped, 'base64url').equals(Buffer.from(signature, 'base64url'))).toBe(
      false,
    )
    expect(verifyInvite(`${payloadPart}.${flipped}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  it("rejects a flip of the last character's spare bits, which leaves the decoded bytes equal", () => {
    // 43 characters carry 258 bits for 256: the last character's two low bits decode to nothing.
    const [payloadPart, signature] = parts(signInvite(PAYLOAD, SECRET))
    const last = signature.length - 1
    const flipped = signature.slice(0, last) + charAt(alphabetIndex(signature.charAt(last)) ^ 0b01)
    expect(flipped).not.toBe(signature)
    expect(Buffer.from(flipped, 'base64url').equals(Buffer.from(signature, 'base64url'))).toBe(true)
    expect(verifyInvite(`${payloadPart}.${flipped}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  it.each([
    ['one character longer', (s: string) => `${s}A`],
    ['one character shorter', (s: string) => s.slice(1)],
  ])('rejects a signature %s before comparing', (_, change) => {
    const [payloadPart, signature] = parts(signInvite(PAYLOAD, SECRET))
    expect(verifyInvite(`${payloadPart}.${change(signature)}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  it('rejects a token signed with another secret', () => {
    const other = randomBytes(32).toString('base64url')
    expect(verifyInvite(signInvite(PAYLOAD, other), SECRET, NOW)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  it('rejects an Invite at its expiry as expired', () => {
    expect(verifyInvite(signInvite(PAYLOAD, SECRET), SECRET, PAYLOAD.x)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('checks the signature before the expiry: a forged expired Invite is a signature failure', () => {
    const forged = signInvite(PAYLOAD, randomBytes(32).toString('base64url'))
    expect(verifyInvite(forged, SECRET, PAYLOAD.x)).toEqual({ ok: false, reason: 'signature' })
  })

  it('rejects a validly signed payload with a bad field as unreadable', () => {
    const token = signedToken(JSON.stringify({ ...PAYLOAD, l: 'de' }))
    expect(verifyInvite(token, SECRET, NOW)).toEqual({ ok: false, reason: 'unreadable' })
  })

  it('checks the signature before the fields: an unsigned bad payload is a signature failure', () => {
    const [, signature] = parts(signInvite(PAYLOAD, SECRET))
    const token = `${Buffer.from('not json', 'utf8').toString('base64url')}.${signature}`
    expect(verifyInvite(token, SECRET, NOW)).toEqual({ ok: false, reason: 'signature' })
  })

  it.each([
    ['an empty string', ''],
    ['one part', encodePayload(PAYLOAD)],
    ['three parts', 'a.b.c'],
    ['a character outside base64url', `${encodePayload(PAYLOAD)}.sig=`],
  ])('rejects %s as unreadable', (_, token) => {
    expect(verifyInvite(token, SECRET, NOW)).toEqual({ ok: false, reason: 'unreadable' })
  })
})
