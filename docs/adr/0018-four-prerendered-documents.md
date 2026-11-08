# ADR 0018 — Four pre-rendered documents; the Discovery Form is its own client-rendered entry

Status: Accepted (2026-11-08) — ticket #102 (T1) for /start; /start/discovery reserved here and
built by T3a. Plan `docs/plan/increment-2.md` §2, §3; the approved plan on #102:
[comment 6720392022](https://github.com/cov1983/portfolio/issues/102#issuecomment-6720392022)

## Context

ADR 0010 pre-renders two routes: `/` (the Title Screen, hydrated) and `/exhibits` (the Fallback
Page, no script). The spec's Implementation decisions › "Routes" (increment-2) add two more:

- /start: plain HTML like the Fallback Page, no script (Q2, Q16); its own title and description
  (AC-5.2); neither the World bundle nor the Discovery Form's code requested (AC-5.3).
- /start/discovery: the Discovery Form, its own route and chunk, script required (Q16), with the
  consent statement (AC-9.3) and the message for a page without script or without an Invite
  (AC-6.4, AC-6.5) in its pre-rendered output.

AC-16.2 keeps the form's code out of every chunk the root address loads.

## Decision

- `build/prerender.ts`'s `ROUTES` gains `/start` (`file: 'start/index.html'`, `script: false`). It
  is filled into the same script-free shell as the Fallback Page (`fallbackShell`, the client
  build's stylesheets only) and rendered by `src/entry-prerender.tsx` with `renderToStaticMarkup`.
  Its head comes from the same `Meta` as the other documents, with its own title and a description
  of its own (the Owner's /start sentence from `content/site.yaml`).
- `/start/discovery` is reserved: T3a adds it to `ROUTES` with a third shell that links the
  `discovery` entry only, and Vite builds a second client entry, `src/discovery/main.tsx` per plan §3. That page
  ships its pre-rendered shell, then mounts the form with `createRoot` (not `hydrateRoot`) into its
  own container, since what the page shows depends on the URL fragment, which the build cannot know.
  Until T3a the route is not in `ROUTES`, because `prerender()` has no case for it.
- No router, as ADR 0010: every document is its own file under `dist/`, served by `vercel.json`'s
  `cleanUrls` and, in `vite preview`, by `cleanUrl`'s mirror of it.

## Consequences

- ADR 0010's route count ("two routes", "A third route is a third entry") is this ADR's; its
  mechanism (Vite SSR build, `react-dom/server`, the shell fill) is unchanged.
- T3a confirms or amends the `/start/discovery` bullet of the Decision when it builds that route
  (ai-review round 1 on #123, finding 7).
- No hydration mismatch is possible on /start/discovery: nothing there is hydrated.
- The build half (`tests/build`) checks each document it ships: /start pre-rendered with its own
  title and description and no script (T1); the discovery document and the chunk graph, with no
  `src/discovery/` or `src/intake/` code in the root's chunks, per plan §2 (T3a, AC-16.2).
- /start's copy outside the Owner's sentence lives in `src/site/StartPage.tsx`; the sentence is
  content, validated at build like increment-1's.
