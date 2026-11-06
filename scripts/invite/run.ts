// The invite CLI's logic (plan increment-2 §5 "Invite CLI"; ADR 0019): `make invite` runs
// scripts/invite.ts, the terminal shell, which wires this to the process. All I/O is injected, so
// the unit tests drive it (AC-14.1–14.4) and the coverage ratchet measures it.
//
// Every refusal is one fixed string from MESSAGES, never interpolated: stderr can be pasted into a
// ticket or an agent's context, so it never carries the secret, the Client's name or e-mail.
// Everything the environment decides is checked before the first prompt, so a refusal never costs
// the Owner typing. The import closure (node:*, src/intake/invite.ts, src/intake/server/sign.ts) is
// gated by ESLint: the CLI runs under plain Node with no node_modules.
import { checkEmail, checkName, type InvitePayload } from '../../src/intake/invite.ts'
import { signInvite } from '../../src/intake/server/sign.ts'

export type InviteIo = {
  env: Readonly<Record<string, string | undefined>>
  now: () => Date
  /** Shows the prompt (on stderr) and resolves with the line typed, without its line break. */
  ask: (prompt: string) => Promise<string>
  /** stdout: only the link. */
  out: (line: string) => void
  /** stderr: only MESSAGES. */
  err: (line: string) => void
}

export const DEFAULT_ORIGIN = 'https://thomascova.dev'
export const DEFAULT_DAYS = 30
/** The Owner's cap (#101, comment 6683301033, change 3): a typo never mints a near-permanent link. */
export const MAX_DAYS = 365
const DAY_SECONDS = 86_400

export const PROMPTS = { name: 'Client name: ', email: 'Client e-mail: ' } as const

const NO_LINK = 'No link was printed.'

export const MESSAGES = {
  secret: `make invite: INVITE_SECRET is not set in this shell (docs/runbooks/invite.md). ${NO_LINK}`,
  lang: `make invite: INVITE_LANG must be en or unset; increment-2 is English only. ${NO_LINK}`,
  days: `make invite: DAYS must be a whole number from 1 to 365. ${NO_LINK}`,
  origin: `make invite: ORIGIN must be an origin only (https, or http on localhost or 127.0.0.1; no path, query, fragment or credentials). ${NO_LINK}`,
  name: {
    empty: `make invite: the Client's name is empty. ${NO_LINK}`,
    control: `make invite: the Client's name contains a control character or a line break (CR, LF, U+0085, U+2028, U+2029). ${NO_LINK}`,
    'edge-space': `make invite: the Client's name starts or ends with whitespace; it is never trimmed, retype it. ${NO_LINK}`,
    'too-long': `make invite: the Client's name is longer than 80 characters (code points after NFC). ${NO_LINK}`,
  },
  email: {
    'edge-space': `make invite: the Client's e-mail starts or ends with whitespace; it is never trimmed, retype it. ${NO_LINK}`,
    invalid: `make invite: the Client's e-mail must be exactly one address, local@domain, with no spaces, line breaks or ,;<>"(). ${NO_LINK}`,
  },
} as const

export async function runInvite(io: InviteIo): Promise<0 | 1> {
  const fail = (message: string): 1 => {
    io.err(message)
    return 1
  }

  const secret = io.env.INVITE_SECRET
  if (secret === undefined || secret === '') return fail(MESSAGES.secret)
  if (!isEnglish(io.env.INVITE_LANG)) return fail(MESSAGES.lang)
  const days = parseDays(io.env.DAYS)
  if (days === null) return fail(MESSAGES.days)
  const origin = parseOrigin(io.env.ORIGIN)
  if (origin === null) return fail(MESSAGES.origin)

  const name = await io.ask(PROMPTS.name)
  const nameCheck = checkName(name)
  if (nameCheck !== 'ok') return fail(MESSAGES.name[nameCheck])
  const email = await io.ask(PROMPTS.email)
  const emailCheck = checkEmail(email)
  if (emailCheck !== 'ok') return fail(MESSAGES.email[emailCheck])

  const nowSeconds = Math.floor(io.now().getTime() / 1000)
  const payload: InvitePayload = {
    v: 1,
    n: name.normalize('NFC'),
    e: email,
    l: 'en',
    x: nowSeconds + days * DAY_SECONDS,
  }
  io.out(`${origin}/start/discovery#i=${signInvite(payload, secret)}`)
  return 0
}

/** AC-14.3: `en`, or unset (make passes an empty value as unset). */
function isEnglish(lang: string | undefined): boolean {
  return lang === undefined || lang === '' || lang === 'en'
}

/** Whole days, 1–365, written as plain decimal digits; unset or empty means 30. */
function parseDays(value: string | undefined): number | null {
  if (value === undefined || value === '') return DEFAULT_DAYS
  if (!/^[0-9]+$/.test(value)) return null
  const days = Number(value)
  return days >= 1 && days <= MAX_DAYS ? days : null
}

/** The link's origin (AC-14.1); unset or empty means production. */
function parseOrigin(value: string | undefined): string | null {
  if (value === undefined || value === '') return DEFAULT_ORIGIN
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  const bare =
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === ''
  const local =
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  return bare && (url.protocol === 'https:' || local) ? url.origin : null
}
