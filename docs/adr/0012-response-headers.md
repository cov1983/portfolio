# ADR 0012 — Response headers: CSP and companions in vercel.json, mirrored into vite preview

Status: Accepted (2026-10-10)

## Context

The spec made response headers a plan decision; ADR 0006 shipped none. The site has no backend,
no third-party resource, no inline script, and one WebAssembly module (Rapier).

## Decision

`vercel.json` `headers` for `/(.*)`: a Content-Security-Policy of `default-src 'none'` with `'self'`
for script (plus `'wasm-unsafe-eval'`), style, img, media, font, connect and manifest, `base-uri
'none'`, `form-action 'none'`, `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`;
`Referrer-Policy: strict-origin-when-cross-origin`; a restrictive `Permissions-Policy`;
`Cross-Origin-Opener-Policy: same-origin`. `vite.config.ts` reads the same array into
`preview.headers` and `server.headers`, so e2e, perf and `make dev` run under the policy, and the
e2e fixture fails on any `securitypolicyviolation`.

## Consequences

- No inline `style=""` in pre-rendered HTML; CSS classes only. No inline scripts. System fonts.
- `'wasm-unsafe-eval'` is the single relaxation and is documented next to the Rapier import.
- The headers ship in their own ticket (T0) before any World code, proven against the Phase 0b
  skeleton's canvas and `world-playable` canary in all three CI browsers and under `make perf`.
- On a Vercel preview URL the toolbar injected for a logged-in Owner is blocked by this policy and
  logs a violation; expected, Visitor- and CI-neutral. The Owner's measurement procedure (plan §6)
  uses a logged-out profile or records the violation as expected; disabling the toolbar for the
  project is the alternative.
- A new resource type (a worker, a manifest) is a one-line change in `vercel.json`, reviewed by
  the Owner (CODEOWNERS).
