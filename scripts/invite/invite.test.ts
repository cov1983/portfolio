import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { decodeInvite } from '../../src/intake/invite.ts'
import { verifyInvite } from '../../src/intake/server/sign.ts'
import { MESSAGES, PROMPTS, runInvite } from './run.ts'

// AC-14.1–14.4 (plan increment-2 §5 "Invite CLI", §6): the CLI's logic through injected I/O. The
// secret is drawn at run time, never a committed literal; the Client is invented.
const SECRET = randomBytes(32).toString('base64url')
const NOW = new Date('2026-11-06T10:00:00.250Z')
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const DAY = 86_400
const NAME = 'Ada Example'
const EMAIL = 'ada@example.com'
const ALL_MESSAGES: readonly string[] = Object.values(MESSAGES).flatMap((m) =>
  typeof m === 'string' ? [m] : Object.values(m),
)

type Run = { code: 0 | 1; out: string[]; err: string[]; asked: string[] }

async function invite(
  env: Record<string, string | undefined>,
  answers: readonly string[] = [NAME, EMAIL],
): Promise<Run> {
  const out: string[] = []
  const err: string[] = []
  const asked: string[] = []
  const queue = [...answers]
  const code = await runInvite({
    env,
    now: () => NOW,
    ask: (prompt) => {
      asked.push(prompt)
      return Promise.resolve(queue.shift() ?? '')
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  })
  return { code, out, err, asked }
}

function tokenOf(link: string | undefined): string {
  return (link ?? '').split('#i=')[1] ?? ''
}

/** A refusal: exit 1, stdout empty, one fixed message naming the cause, and none of the values. */
function expectRefused(run: Run, mentions: string, values: readonly string[]): void {
  expect(run.code).toBe(1)
  expect(run.out).toEqual([])
  expect(run.err).toHaveLength(1)
  const [message = ''] = run.err
  expect(ALL_MESSAGES).toContain(message)
  expect(message).toContain(mentions)
  for (const value of values.filter((v) => v.length > 0)) expect(message).not.toContain(value)
}

describe('AC-14.1: the link', () => {
  it('prints one line: the production origin, /start/discovery and the Invite in the fragment', async () => {
    const run = await invite({ INVITE_SECRET: SECRET })
    expect(run.code).toBe(0)
    expect(run.err).toEqual([])
    expect(run.out).toHaveLength(1)
    expect(run.out[0]).toMatch(
      /^https:\/\/thomascova\.dev\/start\/discovery#i=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/,
    )
  })

  it("carries the Client's name and e-mail, language en and an expiry of now + 30 days", async () => {
    const run = await invite({ INVITE_SECRET: SECRET })
    expect(decodeInvite(tokenOf(run.out[0]))).toMatchObject({
      kind: 'readable',
      payload: { v: 1, n: NAME, e: EMAIL, l: 'en', x: NOW_SECONDS + 30 * DAY },
    })
  })

  it('mints a token verifyInvite accepts with the same secret', async () => {
    const run = await invite({ INVITE_SECRET: SECRET })
    expect(verifyInvite(tokenOf(run.out[0]), SECRET, NOW_SECONDS)).toMatchObject({ ok: true })
  })

  it('honours DAYS', async () => {
    const run = await invite({ INVITE_SECRET: SECRET, DAYS: '7' })
    expect(decodeInvite(tokenOf(run.out[0]))).toMatchObject({
      payload: { x: NOW_SECONDS + 7 * DAY },
    })
  })

  it.each(['1', '365'])('accepts DAYS=%s at the edge of the range', async (days) => {
    const run = await invite({ INVITE_SECRET: SECRET, DAYS: days })
    expect(decodeInvite(tokenOf(run.out[0]))).toMatchObject({
      payload: { x: NOW_SECONDS + Number(days) * DAY },
    })
  })

  it.each([
    [
      'a preview origin',
      'https://portfolio-git-feat-x-cov1983.vercel.app',
      'https://portfolio-git-feat-x-cov1983.vercel.app',
    ],
    ['an origin with a trailing slash', 'https://thomascova.dev/', 'https://thomascova.dev'],
    ['localhost over http, for make preview', 'http://localhost:4173', 'http://localhost:4173'],
    ['127.0.0.1 over http', 'http://127.0.0.1:4173', 'http://127.0.0.1:4173'],
  ])('honours ORIGIN: %s', async (_, origin, expected) => {
    const run = await invite({ INVITE_SECRET: SECRET, ORIGIN: origin })
    // A prefix compared as text: no pattern built from the origin, so nothing in it needs escaping.
    const prefix = `${expected}/start/discovery#i=`
    expect(run.out[0]?.slice(0, prefix.length)).toBe(prefix)
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['en', 'en'],
  ])('mints with INVITE_LANG %s', async (_, lang) => {
    const run = await invite({ INVITE_SECRET: SECRET, INVITE_LANG: lang })
    expect(run.code).toBe(0)
  })

  it('mints the name in NFC', async () => {
    const run = await invite({ INVITE_SECRET: SECRET }, ['Rene\u0301 Example', EMAIL])
    expect(decodeInvite(tokenOf(run.out[0]))).toMatchObject({ payload: { n: 'Ren\u00e9 Example' } })
  })

  it('mints the e-mail in NFC, the form its cap counts', async () => {
    const run = await invite({ INVITE_SECRET: SECRET }, [NAME, 'rene\u0301@example.com'])
    expect(decodeInvite(tokenOf(run.out[0]))).toMatchObject({
      payload: { e: 'ren\u00e9@example.com' },
    })
  })

  it('mints with a secret of exactly 32 characters', async () => {
    const run = await invite({ INVITE_SECRET: SECRET.slice(0, 32) })
    expect(run.code).toBe(0)
  })

  it('asks for the name, then the e-mail, and never echoes a prompt on stdout', async () => {
    const run = await invite({ INVITE_SECRET: SECRET })
    expect(run.asked).toEqual([PROMPTS.name, PROMPTS.email])
    expect(run.out.join('')).not.toContain(PROMPTS.name)
  })
})

describe('AC-14.2: no secret', () => {
  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])(
    'fails when INVITE_SECRET is %s, names it, prints no link and asks nothing',
    async (_, secret) => {
      const run = await invite({ INVITE_SECRET: secret })
      expectRefused(run, 'INVITE_SECRET', [NAME, EMAIL])
      expect(run.asked).toEqual([])
    },
  )

  it('fails on a secret shorter than 32 characters, names it, prints no link and asks nothing', async () => {
    const short = SECRET.slice(0, 31)
    const run = await invite({ INVITE_SECRET: short })
    expectRefused(run, 'shorter than 32', [short, NAME, EMAIL])
    expect(run.asked).toEqual([])
  })
})

describe('AC-14.3: a language other than en', () => {
  it.each(['de', 'EN', 'en-GB'])(
    'fails with INVITE_LANG=%s, before asking anything',
    async (lang) => {
      const run = await invite({ INVITE_SECRET: SECRET, INVITE_LANG: lang })
      expectRefused(run, 'INVITE_LANG', [SECRET, NAME, EMAIL])
      expect(run.asked).toEqual([])
    },
  )
})

describe('AC-14.4: a refused name or e-mail', () => {
  it.each([
    ['CR', 'Ada\rExample'],
    ['LF', 'Ada\nExample'],
    ['U+0085', 'Ada\u0085Example'],
    ['U+2028', 'Ada\u2028Example'],
    ['U+2029', 'Ada\u2029Example'],
    ['U+061C, the Arabic letter mark', 'Ada\u061cExample'],
    ['U+202E, a bidi override', 'Ada\u202eExample'],
    ['U+2066, a bidi isolate', 'Ada\u2066Example'],
    ['a lone surrogate', 'Ada\ud83cExample'],
    ['81 code points', 'a'.repeat(81)],
    ['a trailing space', 'Ada Example '],
    ['a leading space', ' Ada Example'],
    ['nothing', ''],
  ])('refuses a name with %s and never asks for the e-mail', async (_, name) => {
    const run = await invite({ INVITE_SECRET: SECRET }, [name, EMAIL])
    expectRefused(run, 'name', [SECRET, name, EMAIL])
    expect(run.asked).toEqual([PROMPTS.name])
  })

  it.each([
    ['two addresses with a comma', 'ada@example.com, bob@example.com'],
    ['two addresses with a space', 'ada@example.com bob@example.com'],
    ['two at signs', 'ada@bob@example.com'],
    ['CR', 'ada@example.com\rBcc: x@example.com'],
    ['LF', 'ada@example.com\nBcc: x@example.com'],
    ['U+0085', 'ada@exa\u0085mple.com'],
    ['U+2028', 'ada@exa\u2028mple.com'],
    ['U+200B, a format character', 'ada@exa\u200bmple.com'],
    ['a lone surrogate', 'ada@exa\ud83cmple.com'],
    ['a trailing space', 'ada@example.com '],
    ['a leading space', ' ada@example.com'],
  ])('refuses an e-mail with %s', async (_, email) => {
    const run = await invite({ INVITE_SECRET: SECRET }, [NAME, email])
    expectRefused(run, 'e-mail', [SECRET, NAME, email])
  })
})

describe('DAYS and ORIGIN', () => {
  it.each(['0', '366', '-1', '1.5', '7d', ' 7', '1e2', '0x10'])(
    'refuses DAYS=%j before asking anything',
    async (days) => {
      const run = await invite({ INVITE_SECRET: SECRET, DAYS: days })
      expectRefused(run, 'DAYS', [SECRET, NAME, EMAIL])
      expect(run.asked).toEqual([])
    },
  )

  it.each([
    ['plain http to a public host', 'http://thomascova.dev'],
    ['a path', 'https://thomascova.dev/start'],
    ['a query', 'https://thomascova.dev/?a=1'],
    ['a fragment', 'https://thomascova.dev/#x'],
    ['credentials', 'https://user:pass@thomascova.dev'],
    ['no scheme', 'thomascova.dev'],
    ['another scheme', 'ftp://thomascova.dev'],
  ])('refuses ORIGIN with %s before asking anything', async (_, origin) => {
    const run = await invite({ INVITE_SECRET: SECRET, ORIGIN: origin })
    expectRefused(run, 'ORIGIN', [SECRET, NAME, EMAIL])
    expect(run.asked).toEqual([])
  })
})
