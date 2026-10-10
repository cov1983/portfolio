# ADR 0011 — Content pipeline: Markdown + YAML front matter, zod, a Vite plugin, sharp

Status: Proposed (2026-10-10; accepted by `plan: approve increment-1`)

## Context

The spec fixes one Markdown file with front matter per Exhibit, a Bio file, a small site file,
build-time validation that fails naming file and field, build-time image optimisation, and that the
same files feed the Title Screen list, the Panel, the Banner and the Fallback Page.

## Decision

`content/` holds `site.yaml`, `bio.md`, `exhibits/<id>/index.md` and media; the directory name is
the identifier (the spec lists the identifier among the front matter fields; deriving it from the
directory keeps the id, the media directory and the anchor from ever disagreeing). `src/content/schema.ts`
(zod 4) is the schema, with exactly AC-26.1's field list; `loadContent` (`src/content/validate.ts`)
validates, renders Markdown with `markdown-it` at its default `html: false` so raw HTML in a field
is escaped to text (a build fixture proves `<script>` in a summary renders as text), and throws
`ContentError { file, path, message }`; `build/content-plugin.ts` exposes the result as
`virtual:content` and fails the build on error; `build/images.ts` writes AVIF, WebP and a fallback
at 480/960/1440 px with sharp under `dist/media/exhibits/<id>/`, the prefix the download budget
excludes. Dependencies: zod (MIT), yaml (ISC), markdown-it with its types (MIT), sharp
(Apache-2.0). Q4 of the plan (sharp under pnpm 10 and on Vercel's build image) is answered before
this ADR is accepted and folded in here.

Rejected: a CMS or Astro content collections (a second framework); `gray-matter` (unmaintained);
`marked` (no HTML-escaping option; escaping would need a renderer override for html tokens);
`vite-imagetools` (import-query driven, awkward for content-driven file names).

## Consequences

- Publishing is a commit; the build is the validator; nothing is hidden silently (a stray Exhibit
  directory fails the build).
- The `employer-generic` control (written OK referenced in the PR by date, constitution 8) is a
  review rule, not a build rule: `content/**` is in CODEOWNERS and the build adds no field beyond
  AC-26.1's list.
- Site-level images never live under `/media/exhibits/`; otherwise the budget would not count them.
- Image encoding runs on every deploy; a cache directory is a later increment's concern.
