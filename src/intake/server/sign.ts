// The Invite's signing half (plan increment-2 §4, §5; ADR 0019): the invite CLI signs, the function
// (T5) verifies. Server only: it needs node:crypto, so it lives under src/intake/server/, which
// tsconfig.server.json types for Node and tsconfig.json (the browser's) excludes.
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

import {
  decodeInvite,
  encodePayload,
  isExpired,
  splitToken,
  type InvitePayload,
} from '../invite.ts'

export type VerifiedInvite =
  | { ok: true; payload: InvitePayload }
  | { ok: false; reason: 'unreadable' | 'signature' | 'expired' }

/** base64url(HMAC-SHA256(secret, payloadPart)): the signature is over the base64url text, not the JSON. */
function signatureOf(payloadPart: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadPart).digest('base64url')
}

/** The token: `<payloadPart>.<signature>`. */
export function signInvite(payload: InvitePayload, secret: string): string {
  const payloadPart = encodePayload(payload)
  return `${payloadPart}.${signatureOf(payloadPart, secret)}`
}

/**
 * Order: shape, then signature, then fields, then expiry, so nothing of an unsigned payload is read.
 * The expected signature *string* is recomputed and the two ASCII strings are compared in constant
 * time after a length check (timingSafeEqual throws on unequal lengths). The decoded bytes are never
 * compared: the last base64url character's spare bits would let distinct strings verify.
 */
export function verifyInvite(token: string, secret: string, nowSeconds: number): VerifiedInvite {
  const split = splitToken(token)
  if (split === null) return { ok: false, reason: 'unreadable' }
  // splitToken admits only [A-Za-z0-9_-], so 'latin1' maps each character to one byte.
  const expected = Buffer.from(signatureOf(split.payloadPart, secret), 'latin1')
  const given = Buffer.from(split.signature, 'latin1')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'signature' }
  }
  const decoded = decodeInvite(token)
  if (decoded.kind === 'unreadable') return { ok: false, reason: 'unreadable' }
  if (isExpired(decoded.payload, nowSeconds)) return { ok: false, reason: 'expired' }
  return { ok: true, payload: decoded.payload }
}
