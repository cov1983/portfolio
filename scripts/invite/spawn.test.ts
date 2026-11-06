import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import { verifyInvite } from '../../src/intake/server/sign.ts'

// The syntax half of the invite CLI (plan increment-2 §6): invite.test drives the logic through
// Vitest's transform, which accepts syntax plain Node's type stripping refuses (an enum, a
// parameter property). These run the shell as `make invite` does: plain node, a real process, the
// prompts answered on stdin. The secret is drawn at run time, never a committed literal; the Client
// is invented. Neither test reads the host's INVITE_SECRET: each passes its own environment.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PATH = process.env.PATH ?? ''

describe('node scripts/invite.ts', () => {
  it('mints a link that verifies, reading the name and e-mail from stdin', () => {
    const secret = randomBytes(32).toString('base64url')
    const before = Math.floor(Date.now() / 1000)
    const run = spawnSync('node', ['scripts/invite.ts'], {
      cwd: ROOT,
      env: { PATH, INVITE_SECRET: secret },
      input: 'Ada Example\nada@example.com\n',
      encoding: 'utf8',
    })
    expect(run.stderr).toBe('Client name: Client e-mail: ')
    expect(run.status).toBe(0)
    const lines = run.stdout.split('\n').filter((line) => line !== '')
    expect(lines).toHaveLength(1)
    const token = (lines[0] ?? '').split('#i=')[1] ?? ''
    expect(verifyInvite(token, secret, before)).toMatchObject({
      ok: true,
      payload: { n: 'Ada Example', e: 'ada@example.com', l: 'en' },
    })
  })

  it('refuses with exit 1 and an empty stdout when stdin ends before a name', () => {
    const run = spawnSync('node', ['scripts/invite.ts'], {
      cwd: ROOT,
      env: { PATH, INVITE_SECRET: randomBytes(32).toString('base64url') },
      input: '',
      encoding: 'utf8',
    })
    expect(run.status).toBe(1)
    expect(run.stdout).toBe('')
  })
})

describe('make invite on a host without Node 24', () => {
  const stubs = mkdtempSync(join(tmpdir(), 'invite-node-stub-'))
  afterAll(() => {
    rmSync(stubs, { recursive: true, force: true })
  })

  it('prints the devcontainer command, the secret passed by name only, and no link', () => {
    // A `node` that fails every call stands in for one older than 24 (or none): the recipe's
    // version check reads only its exit status.
    const stub = join(stubs, 'node')
    writeFileSync(stub, '#!/bin/sh\nexit 1\n')
    chmodSync(stub, 0o755)
    const run = spawnSync('make', ['-s', 'invite'], {
      cwd: ROOT,
      env: { PATH: `${stubs}:${PATH}` },
      encoding: 'utf8',
    })
    // The recipe exits 1; make reports a failed recipe as 2 (docs/runbooks/invite.md).
    expect(run.status).toBe(2)
    expect(run.stdout).toBe('')
    expect(run.stderr).toContain('Node 24')
    expect(run.stderr).toMatch(/docker run .*-e INVITE_SECRET .* make invite/)
    expect(run.stderr).not.toMatch(/INVITE_SECRET=/)
  })
})
