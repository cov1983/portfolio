# ADR 0016 — One serverless function at the discovery form's boundary, and a first-party draft

Status: Accepted (2026-11-04) — constitution v1.1, principles 5 and 10; issue #59

## Context

Increment 2 adds an invited discovery form at /start/discovery: a Client answers a long
questionnaire and the Owner receives the answers by mail. The site is static (principle 5), stores
nothing and loads no third-party script (principle 10). Considered: a hosted form service
(third-party script, refused by principle 10); a backend with a database (nothing to run it for
one form, and the brief must not persist anywhere but the Owner's mailbox, principle 8); mailto:
(no structure, no way to verify an invite); one serverless function.

## Decision

One function in the existing Vercel project (ADR 0006), POST only. It verifies the HMAC-signed
invite token before reading the body, limits the body size, sends two plain-text mails through
Infomaniak SMTP (the Brief to the Owner with Reply-To the Client; a confirmation to the address
inside the token, never to a typed address) and stores nothing; nothing from the body is logged.
The signing secret and the mailbox credential live in Vercel environment variables and on the
Owner's host, never in the repository or an agent's context. The form keeps a Draft in the
Client's own browser (localStorage), scoped to /start/discovery, cleared on submit and by a visible
control.

## Consequences

- Constitution v1.1: principle 5 names the exception, principle 10 names first-party storage.
- vercel.json and the CSP (connect-src 'self') change under the same ticket; ADR 0006 gets a note.
- The function is tested at its own seam with SMTP mocked; one real send is a recorded Owner
  measurement before the first test Client (principle 2).
- Any backend beyond this function (Supabase was named as the likely direction) needs its own
  amendment and ADR; this one does not open the door.
