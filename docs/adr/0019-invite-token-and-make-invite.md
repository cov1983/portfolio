# ADR 0019 — The Invite token and `make invite`

Status: Accepted (2026-11-06) — ticket #101 (T2), plan `docs/plan/increment-2.md` §3, §4, §5, §6;
Owner decisions on #101: [comment 6683301033](https://github.com/cov1983/portfolio/issues/101#issuecomment-6683301033)
(the approved plan with the Owner's changes) and [comment 6683938059](https://github.com/cov1983/portfolio/issues/101#issuecomment-6683938059)

## Context

ADR 0016 and the spec's Implementation decisions › "Invite (Q10, ADR 0016)" fix an HMAC-signed
token in the URL fragment of /start/discovery, carrying the Client's name, e-mail, language and
expiry, minted on the Owner's host so that the name and e-mail never land in shell history
(AC-14.1–14.4). Three readers share its rules: the invite CLI (this ADR), the Discovery Form's page
(T3a), which can decode and expiry-check but never verify, and the function (T5), which verifies.
CLAUDE.md says a host without Node 24 runs make through the devcontainer image. The CLI runs under
plain Node, whose type stripping refuses non-erasable syntax and which has no `node_modules` there.

## Decision

**Token.** `base64url(UTF-8 JSON { v: 1, n, e, l: 'en', x })` `.` `base64url(HMAC-SHA256(secret,
first part))`; the signature is over the base64url text, not the JSON; `x` is the expiry in Unix
seconds. The link is `<origin>/start/discovery#i=<token>`. **The HMAC key is the secret's UTF-8
text as stored**, not its base64 decoding: `openssl rand -base64 32` yields 44 characters, and those
44 bytes are the key, in the CLI and in the function (T5) alike (#118, ai-review round 1, finding 2).

**One module of field rules, `src/intake/invite.ts`**, pure and import-free (the page bundles it,
the CLI runs it under plain Node; it uses only globals both have: `atob`, `btoa`, `TextEncoder`,
`TextDecoder`). Exports: `NAME_MAX` (80) and `EMAIL_MAX` (254), here and not in `limits.ts`;
`codePoints` and `greetingName` (code points after NFC, counted with `Array.from`, never
graphemes); `checkName` → `ok | empty | control | edge-space | too-long`, in that order, where
control is `\p{Cc}` (so U+0085), U+2028, U+2029, `\p{Bidi_Control}` (U+061C, U+200E, U+200F,
U+202A–U+202E, U+2066–U+2069), and a lone surrogate (`\p{Cs}` in a `u` regex, which is `!isWellFormed()` without
the ES2024 lib); ZWNJ and ZWJ stay allowed for Persian and Indic names; `checkEmail` → `ok |
edge-space | invalid`, where valid is exactly one `local@domain` with no whitespace, no `,;<>"()`,
no control character, no `\p{Cf}` at all, at most 254 code points (Owner decisions on #118's
ai-review round 1, findings 3 and 5); `stripCrLf`; `encodePayload` (the token's first part, also used by the
signer, so there is one encoder); `splitToken` (the two base64url parts or `null`, before any
decoding); `decodeInvite` (`unreadable` for another shape, a length of 1 mod 4, bytes that are not
UTF-8, text that is not JSON, or a bad field); `isExpired` (expired at `x` and after).
- **Non-bidi format characters are allowed in names by decision** (ZWNJ, ZWJ, U+200B, U+2060,
  U+00AD, U+FEFF; Owner decision on #118's ai-review round 2); the e-mail refuses all `\p{Cf}`.
- **Leading or trailing whitespace is refused, never trimmed** (`edge-space`, Owner decision,
  comment 6683301033, change 2): `String.prototype.trim` would also swallow a trailing U+2028, and a
  pasted trailing space would be minted into a link the Owner did not see.
- **A bad field** is a wrong type or value only: `v` not 1, `n` or `e` not strings, `l` not `en`,
  `x` not a positive safe integer. `decodeInvite` does not apply the name or e-mail rules: the CLI
  applies them at minting, the page caps the greeting (`greetingName`), the function strips CR and
  LF (AC-13.5) and rejects nothing for length (plan §4). Fields beyond the five are dropped.
- **The name and the e-mail are minted in NFC** (`n = name.normalize('NFC')`,
  `e = email.normalize('NFC')`), the form the caps count (the e-mail since #118's ai-review round 1,
  finding 4).

**The signing half, `src/intake/server/sign.ts`** (`node:crypto`). `signInvite(payload, secret)`.
`verifyInvite(token, secret, nowSeconds)` checks, in this order: the shape (`splitToken`, else
`unreadable`); the signature, by recomputing the expected signature *string* and comparing the two
ASCII byte strings with `timingSafeEqual` after a length check (`signature`); then the fields
(`decodeInvite`, `unreadable`); then the expiry (`expired`). **The signature is checked before any
field is read**, so nothing of an unsigned payload is parsed into the result. Decoded signature
bytes are never compared: the last base64url character of a 32-byte HMAC carries two spare bits,
so distinct strings decode to the same bytes (ai-review round 3 on #96; `sign.test` has the case).

**`make invite`** runs `node scripts/invite.ts`, a terminal shell over `scripts/invite/run.ts`
(the logic, behind injected I/O: `env`, `now`, `ask`, `out`, `err`). The secret comes from
`INVITE_SECRET` in the environment, refused when unset or empty and, with its own message, when
shorter than 32 characters (UTF-16 code units; Owner decision on #118's ai-review round 1, finding
2); the language from `INVITE_LANG` (not the POSIX `LANG`): unset,
empty or `en`, anything else refused (AC-14.3); `DAYS` and `ORIGIN` from make's command line,
which make passes into the recipe's environment (a spawn test runs `make invite DAYS= ORIGIN=`), or
from the shell's environment when exported there; the name and e-mail from two prompts on stderr,
read through readline's line iterator (its `question()` drops a line piped before it asks).
Everything the environment decides is checked before the first prompt. Stdout carries only the
link. Every refusal is one fixed string from `MESSAGES`, so stderr never carries the secret, the
name or the e-mail; the CLI exits 1.
- **`DAYS` is a whole number from 1 to 365, default 30: the 365 cap is an Owner decision**
  (comment 6683301033, change 3), so a typo never mints a near-permanent link.
- **`ORIGIN`** is an origin only (no path, query, fragment or credentials), `https:`, or `http:`
  on `localhost` or `127.0.0.1` for `make preview`; default `https://thomascova.dev`.
- **Node < 24 or no `node`**: an older Node cannot load a `.ts` file at all, so the check is a
  plain-JavaScript `node -e` in the recipe that reads only an exit status. On failure the recipe
  prints constant lines only (no version found, no `DAYS` or `ORIGIN` value) with the devcontainer
  command, which passes the secret by name: `docker run --rm -it --network none -e INVITE_SECRET
  -v "$PWD:/repo:ro" -w /repo portfolio-dev make invite`.

**The tsconfig split.** `tsconfig.server.json` types `src/intake/server` for Node with no DOM.
`tsconfig.json`, the browser's, excludes `src/intake/server` **and `src/**/*.test.ts`**, and
`tsconfig.node.json` includes `src/**/*.test.ts` and excludes `src/intake/server`, so each file
of `src/intake/server` belongs to exactly one project (a node-project script that imports
`sign.ts` still checks it through the import). The plan assumed the `src/intake/server` exclude
alone would keep Node types out of the browser project. Probing showed it gated nothing: the
`src` tests sat in the browser project and import `vitest`, whose types reach `@types/node`
through Vite's Node API, so Node types were ambient there (66 `@types/node` files; 0 since). A
scratch `import 'node:crypto'` in `src/intake/invite.ts` passed `make typecheck` before the tests
moved and fails it after (TS2882).

**The CLI's import closure** is exactly `scripts/invite.ts`, `scripts/invite/run.ts`,
`src/intake/invite.ts`, `src/intake/server/sign.ts` plus `node:*`, gated in `eslint.config.js` by
one override per file: `@typescript-eslint/no-restricted-imports` with negated `group` patterns
and `allowTypeImports`, `no-import-type-side-effects` (the import rule passes `import { type X }
from 'm'`, which Node's type stripping keeps as a runtime import), and `ImportExpression` banned
(the import rule never sees `import()`). The `group` list starts `'*', '!*/'`: gitignore syntax
cannot re-include a file under an excluded `..` directory unless directories are re-included
first. `src/intake/invite.ts` may import nothing. A spawn test runs `node scripts/invite.ts` as
the recipe does, so non-erasable syntax fails CI.

## Consequences

- The page can decode and expiry-check an Invite but never verify it; only the function, holding
  the secret, can tell a tampered one.
- Rotating `INVITE_SECRET` ends every open Invite; the function's copy is set by T5, and
  `docs/runbooks/invite.md` holds the commands.
- The CLI runs with no `node_modules`; a dependency in its closure fails `make lint`.
- **Residual of the gate**: a `createRequire` from `node:module` would load a package past it.
  The gate catches mistakes, not deliberate circumvention, which review does.
- A `src` test is typed with Node and DOM types (`tsconfig.node.json`), as the tests under
  `tests/` already were; browser code gets neither Node types nor test globals.
- The devcontainer fallback (`--network none`, the read-only mount) is a design choice not
  exercised by any test; the Owner's host is the first place it runs.
- The agent never runs `make invite` with a real secret; tests draw theirs from `randomBytes` at
  run time.
