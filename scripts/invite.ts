// `make invite`'s terminal shell (plan increment-2 §5 "Invite CLI"; ADR 0019; docs/runbooks/invite.md).
// Glue only, outside the coverage ratchet like build/build.ts: it wires scripts/invite/run.ts to
// this process. Prompts go to stderr so stdout holds only the link. The lines are read through
// readline's async iterator, not question(): question() drops a line that arrives before it asks,
// which piped input does. Plain Node 24 runs this file with no node_modules (the import closure is
// gated in eslint.config.js); the agent never runs it with a real secret.
import process from 'node:process'
import { createInterface } from 'node:readline'

import { runInvite } from './invite/run.ts'

const lines = createInterface({ input: process.stdin })
const typed = lines[Symbol.asyncIterator]()

const code = await runInvite({
  env: process.env,
  now: () => new Date(),
  ask: async (prompt) => {
    process.stderr.write(prompt)
    const next = await typed.next()
    return next.done === true ? '' : next.value
  },
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
})
lines.close()
process.exitCode = code
