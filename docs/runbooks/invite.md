# Runbook — minting an Invite with `make invite`

The Owner's procedure for creating an Invite link for one Client (ADR 0019, spec increment-2
US-14). It runs on the Owner's host only. **The agent never runs it with a real secret.**

## Once: the signing secret

1. Generate it: `openssl rand -base64 32` (44 characters; `make invite` refuses a secret shorter
   than 32). The key is that text as stored, not its base64 decoding. Store the output in the password manager as
   `INVITE_SECRET`. It never goes into the repository, a ticket, a prompt or an agent session.
2. The function (T5) holds the same value in Vercel's environment; its runbook covers that side.

## Each time: mint a link

1. Load the secret into this shell without writing it to history:
   `read -rs INVITE_SECRET && export INVITE_SECRET` (paste, Enter; nothing is echoed).
2. From the repository root: `make invite`. Optional, on the same line:
   - `DAYS=7`: the expiry in whole days, 1 to 365 (default 30; the cap is the Owner's decision).
   - `ORIGIN=https://<preview>.vercel.app`: a preview deployment instead of production
     (`https://thomascova.dev`). An origin only: no path. `http://localhost:4173` works for
     `make preview`.

   Both are also read from the shell's environment, so a `DAYS` or `ORIGIN` exported there for
   another tool changes the link; `env | grep -E '^(DAYS|ORIGIN)='` shows them first.
3. Answer the two prompts, `Client name:` and `Client e-mail:`. Never pass them as arguments:
   arguments land in shell history.
4. Stdout is one line, the link: `https://thomascova.dev/start/discovery#i=<token>`. Send it to
   the Client. The token is signed, not encrypted: anyone holding the link can read the name and
   e-mail in it.
5. `unset INVITE_SECRET` when done.

## When it refuses

Every refusal prints one fixed line on stderr that names the cause and never the secret, name or
e-mail; no link is printed. The CLI exits 1; **make reports `make: *** [...] Error 1` and exits 2**.

| message names | cause | fix |
|---|---|---|
| `INVITE_SECRET` | not set, or empty, in this shell | step 1 above |
| `INVITE_SECRET` … shorter than 32 | a truncated or mistyped paste | paste the stored value again |
| `INVITE_LANG` | set to anything but `en` (increment-2 is English only) | `unset INVITE_LANG` |
| `DAYS` | not a whole number from 1 to 365 | e.g. `DAYS=14` |
| `ORIGIN` | a path, query, fragment or credentials, or plain http to a public host | the bare origin |
| the name | empty; a control character or line break (CR, LF, U+0085, U+2028, U+2029), a bidi control or a lone surrogate; leading or trailing whitespace; over 80 characters (code points after NFC) | retype it; nothing is trimmed |
| the e-mail | not exactly one bare `local@domain` (an invisible format character such as U+200B counts against it), or leading or trailing whitespace | retype it |

The name and e-mail prompts only come after the environment checks pass, so a refusal never costs
typing.

## A host without Node 24

`make invite` checks the Node version first. On an older Node, or none, it prints this and exits
2, with no link:

```
docker build -t portfolio-dev .devcontainer
docker run --rm -it --network none -e INVITE_SECRET -v "$PWD:/repo:ro" -w /repo portfolio-dev make invite
```

Run both from the repository root with the secret exported, and add the same `DAYS=` and `ORIGIN=`
to the end of the second line. `-e INVITE_SECRET` passes the secret by name only. The container
has no network, and the repository is mounted read-only; the CLI needs neither.

## Rotation

Rotating `INVITE_SECRET` (a new value in the password manager, on the host and in Vercel) ends
every open Invite at once: their signatures no longer verify. It is also the only way to revoke a
leaked link before its expiry (ADR 0016, accepted risk).

## Verification on a PR that changes the CLI

The Owner mints one link on the host with an invented Client and records in the PR only that it
worked: never the link, the name, the e-mail or the secret.
