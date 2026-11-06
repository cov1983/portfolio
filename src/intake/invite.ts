// The Invite's shared rules (plan increment-2 §4, §5; ADR 0019): one module for the invite CLI, the
// Discovery Form's page and the function. Pure and import-free: the page bundles it and the CLI runs
// it under plain Node, so it uses only what both have as globals (atob, btoa, TextEncoder,
// TextDecoder). It decodes and expiry-checks; verifying the signature is `server/sign.ts`'s.

/** The name cap, in code points after NFC (AC-14.4, AC-6.1). */
export const NAME_MAX = 80
/** The e-mail cap, in code points after NFC. */
export const EMAIL_MAX = 254

export type InvitePayload = { v: 1; n: string; e: string; l: 'en'; x: number }

export type DecodedInvite =
  | { kind: 'readable'; payload: InvitePayload; payloadPart: string; signature: string }
  | { kind: 'unreadable' } // not two base64url parts, not UTF-8, not JSON, or a bad field

// \p{Cc} holds C0, DEL and C1, so U+0085 too; U+2028 and U+2029 are separators, not controls.
// The bidi marks, embeddings, overrides and isolates (U+200E, U+200F, U+202A-U+202E, U+2066-U+2069)
// could show the Owner one name and the Client another; ZWNJ and ZWJ (U+200C, U+200D) stay, since
// Persian and Indic names need them. \p{Cs} in a `u` regex matches only a lone surrogate, so it is
// `!isWellFormed()` without the ES2024 lib (#118, ai-review round 1, findings 3 and 5).
const CONTROL = /[\p{Cc}\p{Cs}\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069]/u
// No real address needs an invisible format character; U+200B would mail another address.
const FORMAT = /\p{Cf}/u
// Leading or trailing whitespace is refused, never trimmed: a trim would also swallow a trailing
// U+2028 (String.prototype.trim removes line terminators) and mint what the Owner did not see.
const EDGE_SPACE = /^\p{White_Space}|\p{White_Space}$/u
const EMAIL_FORBIDDEN = /[\s,;<>"()]/u
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

// Code points, not graphemes, are the unit on purpose (plan §4: one countable rule for CLI, page and
// function, with no Intl.Segmenter data that differs between engines). Array.from iterates a string
// by code point, as the spread `no-misused-spread` warns about would.
function codePointsOf(s: string): string[] {
  return Array.from(s.normalize('NFC'))
}

/** The counting unit of every text cap: code points after NFC. */
export function codePoints(s: string): number {
  return codePointsOf(s).length
}

/** What the page greets with: at most the first 80 code points of the NFC form (AC-6.1). */
export function greetingName(name: string): string {
  return codePointsOf(name).slice(0, NAME_MAX).join('')
}

export function checkName(name: string): 'ok' | 'empty' | 'control' | 'edge-space' | 'too-long' {
  if (name.length === 0) return 'empty'
  if (CONTROL.test(name)) return 'control'
  if (EDGE_SPACE.test(name)) return 'edge-space'
  if (codePoints(name) > NAME_MAX) return 'too-long'
  return 'ok'
}

/** Exactly one bare address, `local@domain` (AC-14.4). */
export function checkEmail(email: string): 'ok' | 'edge-space' | 'invalid' {
  if (EDGE_SPACE.test(email)) return 'edge-space'
  const sides = email.split('@')
  if (sides.length !== 2 || sides.some((side) => side.length === 0)) return 'invalid'
  if (CONTROL.test(email) || FORMAT.test(email) || EMAIL_FORBIDDEN.test(email)) return 'invalid'
  if (codePoints(email) > EMAIL_MAX) return 'invalid'
  return 'ok'
}

/** The function strips CR and LF from the name before any use (AC-13.5). */
export function stripCrLf(s: string): string {
  return s.replace(/[\r\n]/g, '')
}

/** The payload part of the token: base64url of the payload's UTF-8 JSON. */
export function encodePayload(payload: InvitePayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const UNREADABLE: DecodedInvite = { kind: 'unreadable' }

/** The token's two base64url parts, or null when it has another shape. Used before any decoding,
 * so `verifyInvite` can check the signature before it reads a field. */
export function splitToken(token: string): { payloadPart: string; signature: string } | null {
  if (!TOKEN.test(token)) return null
  const dot = token.indexOf('.')
  return { payloadPart: token.slice(0, dot), signature: token.slice(dot + 1) }
}

/** Reads an Invite without verifying it: the page cannot, only the function can (`server/sign.ts`). */
export function decodeInvite(token: string): DecodedInvite {
  const split = splitToken(token)
  if (split === null) return UNREADABLE
  const { payloadPart, signature } = split
  // A base64url text of length 1 mod 4 encodes no whole byte; every other length decodes.
  if (payloadPart.length % 4 === 1) return UNREADABLE
  const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  let json: unknown
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    // Not UTF-8 or not JSON: the token is untrusted input, and its class is the answer.
    return UNREADABLE
  }
  const payload = toPayload(json)
  return payload === null ? UNREADABLE : { kind: 'readable', payload, payloadPart, signature }
}

// Type and value of each field only. The name and e-mail rules are the CLI's at minting; the page
// caps the greeting and the function strips CR and LF (plan §4).
function toPayload(json: unknown): InvitePayload | null {
  if (typeof json !== 'object' || json === null) return null
  const fields = json as Record<string, unknown>
  const { v, n, e, l, x } = fields
  if (v !== 1 || typeof n !== 'string' || typeof e !== 'string' || l !== 'en') return null
  if (typeof x !== 'number' || !Number.isSafeInteger(x) || x <= 0) return null
  return { v, n, e, l, x }
}

/** Expired at `x` and after; `x` is in Unix seconds. */
export function isExpired(payload: InvitePayload, nowSeconds: number): boolean {
  return nowSeconds >= payload.x
}
