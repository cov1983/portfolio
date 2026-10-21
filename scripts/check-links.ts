// `node scripts/check-links.ts`: the weekly link check (T9 #34; .github/workflows/links.yml, Monday
// 06:30 UTC, non-blocking, never run by the build). The content is read through the build's own
// loader, so every build check applies first (a ContentError ends the run with its message on
// stderr, exit 1, never swallowed); each external links[].url is then fetched once with the global
// fetch (scripts/links/check.ts: GET, redirects followed, 10 s), one line per link, a ::error::
// annotation and exit 1 on any non-2xx.
//
// Runs under plain Node 24 (type stripping), so imports carry the .ts extension. The import probe
// of 2026-10-21 (#34, Task 3) loaded build/content-plugin.ts this way in 120 ms, 107 MB resident:
// its `vite` imports are type-only, the runtime graph is sharp, zod, yaml and markdown-it, which
// the setup action's `pnpm install --frozen-lockfile` provides.
import { loadContentFromDisk } from '../build/content-plugin.ts'
import { checkLinks, exitCode, externalLinks, formatLines } from './links/check.ts'

async function main(): Promise<number> {
  const content = await loadContentFromDisk()
  const outcomes = await checkLinks(externalLinks(content), fetch)
  for (const line of formatLines(outcomes)) console.log(line)
  return exitCode(outcomes)
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    // A ContentError, or anything else that escapes main: its message as an annotation on
    // stderr, never a bare stack trace alone (ai-review on #73, finding 4).
    console.error(`::error::link check: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  },
)
