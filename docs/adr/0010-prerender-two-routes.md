# ADR 0010 — Pre-rendering: a Vite SSR build of two routes, rendered with react-dom/server

Status: Proposed (2026-10-10; accepted by `plan: approve increment-1`)

## Context
ADR 0004 decided that `/` and the Fallback Page are pre-rendered and left the mechanism to the plan.
There are exactly two routes, no data fetching, and the content is a build-time module.

## Decision
`node build/build.ts` runs Vite's client build, then an SSR build of `src/entry-prerender.tsx`,
then renders `TitleScreen` and `FallbackPage` with `react-dom/server` into `dist/index.html` (meta
and Open Graph tags included) and `dist/exhibits/index.html`. The Title Screen hydrates with
`hydrateRoot`; the Fallback Page ships no script. No router: the Panel is state, not URL. The World
chunk is a dynamic import started after the `title-screen-interactive` mark unless a coarse pointer
was detected; the World mounts paused behind the Title Screen and records `world-playable`.
`make build` and `vercel.json`'s `buildCommand` both run `node build/build.ts`.

Rejected: Astro, Vike, vite-react-ssg (a framework for two routes); a DOM-wiring Title Screen
without React hydration (two UI techniques for one tree).

## Consequences
- Pre-rendered markup must equal the first client render: capability hints are added after hydration.
- The entity-encoded Contact anchor is a static HTML island (`dangerouslySetInnerHTML`), not compared by hydration.
- A third route is a third entry in `build/prerender.ts`, nothing else.
