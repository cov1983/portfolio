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

**Q1, measured 2026-10-10** (tag `prototype/q1-q4`, commit adce29a; three runs on the 10 Mbit profile): with
a pre-rendered stub Title Screen hydrated by a 70 KB (gzip) `site` chunk and a 3.14 MB `world`
chunk (three + React Three Fiber + Rapier compat) imported in an idle callback after the mark,
`title-screen-interactive` lands at 188 ms (median; load event at 179 ms), the longest main-thread
task between the two marks is 53 ms (median; maximum 65 ms: the chunk's evaluation at about
1.1 s), TBT 3 ms, `world-playable` 1312 ms. The chunk stays one: no split (the prototype's
`WorldSplit.tsx` shows the Rapier-on-mount split should the real chunk ever need it).
`limits.longTaskBetweenMarksMs` is **100 ms**: twice Lighthouse's 50 ms long-task floor, a stall a
Visitor can see, 1.5× the measured maximum; the real chunk adds model and scene code, a few
percent of three's size, so 200 ms would never trip.

Rejected: Astro, Vike, vite-react-ssg (a framework for two routes); a DOM-wiring Title Screen
without React hydration (two UI techniques for one tree).

## Consequences

- Pre-rendered markup must equal the first client render: capability hints are added after
  hydration.
- The entity-encoded Contact anchor is a static HTML island (`dangerouslySetInnerHTML`), not
  compared by hydration.
- A third route is a third entry in `build/prerender.ts`, nothing else.
- Chunking in Vite 8 (Rolldown) is `build.rollupOptions.output.codeSplitting.groups`, not
  `manualChunks`: one `world` group matching `three`, `@react-three` and `@dimforge` with
  `includeDependenciesRecursively: false`, so React stays in the entry chunk; the `tests/build`
  isolation check reads the entry chunk's static imports.
- The demand frame that records `world-playable` reads readiness from a ref, not from React state:
  `invalidate()` schedules the frame before a `setState` commits, and a frame rendered on stale
  state requests no second frame, so the mark would never fire (found by the Q1 prototype).
