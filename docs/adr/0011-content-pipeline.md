# ADR 0011 — Content pipeline: Markdown + YAML front matter, zod, a Vite plugin, sharp

Status: Accepted (2026-10-10)

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
(Apache-2.0).

**Q4, researched and probed 2026-10-10:** sharp 0.34.5 installs and runs under pnpm 10's
build-script policy **without** an `onlyBuiltDependencies` entry. Since 0.33 the binaries are
optional dependencies (`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`, glibc ≥ 2.28); the
`install` script (`install/check.js`) only acts when building from source against a global libvips,
and the maintainer states that prebuilt-binary users should list sharp under
`ignoredBuiltDependencies` instead (lovell, sharp issue 4343, 2025-03-05; the install docs since
0.34.5: "When using pnpm, add sharp to ignoredBuiltDependencies to silence warnings"). pnpm 10 does
not run dependency lifecycle scripts by default (pnpm 10.0.0 release notes); the install prints
"Ignored build scripts: sharp@0.34.5" and exits 0 (`strictDepBuilds` is unset in 10.34.6). Probed
with `pnpm install` of sharp 0.34.5 under pnpm 10.34.6: in the devcontainer (Debian 12, glibc 2.36,
Node 24.21.0) and in `amazonlinux:2023` (glibc 2.34, Node 24.21.0), the base image Vercel documents
for its build image: exit 0 with the warning, `sharp.versions.vips` 8.17.3, an AVIF encode succeeds.
Vercel runs pnpm 10 for new projects whose lockfile is `lockfileVersion: '9.0'` (changelog
2025-02-28) and the `packageManager` field under Corepack. T3 therefore adds
`"pnpm": { "ignoredBuiltDependencies": ["sharp"] }` to `package.json` (silences the warning, records
the decision) and no allowlist entry; pnpm 11 replaces the setting with `allowBuilds`, which the
Renovate major PR will surface. sharp 0.35 exists; T3 takes the newest the toolchain accepts
(CLAUDE.md rule).

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
