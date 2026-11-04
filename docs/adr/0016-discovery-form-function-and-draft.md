# ADR 0016 — One serverless function at the Discovery Form's boundary, and a first-party Draft

Status: Accepted (2026-11-04) — constitution v1.1, principles 5 and 10; issue #59

## Context

Increment 2 adds an invited Discovery Form at /start/discovery: a Client fills it in and the Owner
receives the answers by mail. The site is static (principle 5), stores nothing and loads no
third-party script (principle 10). Considered: a hosted form service (third-party script, refused
by principle 10); a backend with a database (nothing to run it for one form, and a Brief lives only
in the Owner's mailbox — Owner decision Q6 on #59; principle 8 keeps it out of the repository and
prompts); mailto: (no structure, no way to verify an Invite); one serverless function.

## Decision

One function in the existing Vercel project (ADR 0006), POST only. It verifies the Invite's
HMAC-signed token before reading the body, limits the body size, sends two plain-text mails through
Infomaniak SMTP (the Brief to the Owner with Reply-To the Client; a confirmation to the address
inside the Invite's token, never to a typed address) and stores nothing; nothing from the body is
logged. The Invite travels in the URL fragment of /start/discovery, which the browser never sends;
the page passes it to the function in a request header, never in the URL, so no request log holds
a Client's name or e-mail. Verification checks the signature with a constant-time compare and the
expiry. The signing secret and the mailbox credential live in Vercel environment variables and on
the Owner's host, never in the repository or an agent's context. The form keeps a Draft in the
Client's own browser: one localStorage key, used only by /start/discovery, cleared on submit and by
a visible control.

## Consequences

- Constitution v1.1: principle 5 allows a serverless function at a form's submit boundary as a
  class, each introduced by its own spec and ADR, and no longer says "until a spec says
  otherwise" — any backend beyond a form-boundary function (a database, server-side storage, a
  scheduled job) needs its own amendment and ADR (Supabase was named as the likely direction);
  principle 10 names first-party browser storage as the only storage a spec can introduce, and
  keeps counting behind a spec.
- vercel.json and the CSP (connect-src 'self') change under the spec's function ticket; ADR 0006
  gets a note there.
- The function is tested at its own seam with SMTP mocked; one real send is a recorded Owner
  measurement before the first test Client (principle 2).
- A leaked Invite can submit, and so trigger confirmation mails to the Client, until its expiry
  (30 days, Owner decision Q10/Q11); revocation is rotating the signing secret, which ends every
  open Invite. The runbook written by the function ticket covers rotation.
- Accepted risk, v1: no alert on a failed send. The Client sees an error naming the Owner's
  address; the function's log carries a status and nothing personal. An alert is a later spec's.
