// `node build/build.ts`: the single build command of `make build` and vercel.json (ADR 0010).
// Vite's client build into the output directory, then an SSR build of src/entry-prerender.tsx,
// then both documents of build/prerender.ts assembled from the client build's index.html and
// written under the output directory. I/O glue, outside the coverage ratchet (plan §6); the pure
// parts live in build/prerender.ts. Runs under plain Node 24 (type stripping), so relative imports
// carry the .ts extension. Flags mirror `vite build`: --outDir <dir> and --emptyOutDir.
//
// The SSR bundle is written to a fresh directory under Vite's cacheDir (node_modules/.vite):
// React and react-dom/server stay external to it and resolve through the project's node_modules,
// each build has its own directory (tests/build runs several builds in parallel), nothing lands
// in dist/ or the worktree (ADR 0008), and it is removed afterwards (Owner, #27 Q2).
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { build, resolveConfig } from 'vite'

import { ROUTES, fillShell, withoutScripts, type Fragments } from './prerender.ts'

const PRERENDER_ENTRY = 'src/entry-prerender.tsx'

type PrerenderModule = { prerender: (route: string) => Fragments }

function isPrerenderModule(value: unknown): value is PrerenderModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'prerender' in value &&
    typeof value.prerender === 'function'
  )
}

/** The entry chunk's file name from what `build()` returns, or an error naming what was returned. */
function entryFileName(result: Awaited<ReturnType<typeof build>>): string {
  const outputs = Array.isArray(result) ? result : [result]
  for (const output of outputs) {
    if (!('output' in output)) continue
    for (const chunk of output.output) {
      if (chunk.type === 'chunk' && chunk.isEntry) return chunk.fileName
    }
  }
  throw new Error('the SSR build produced no entry chunk')
}

async function buildPrerenderModule(
  cacheDir: string,
): Promise<{ dir: string; load: () => Promise<PrerenderModule> }> {
  await mkdir(cacheDir, { recursive: true })
  const dir = await mkdtemp(join(cacheDir, 'prerender-'))
  const result = await build({
    logLevel: 'warn',
    build: { ssr: PRERENDER_ENTRY, outDir: dir, emptyOutDir: true, copyPublicDir: false },
  })
  const file = join(dir, entryFileName(result))
  return {
    dir,
    load: async () => {
      const loaded: unknown = await import(pathToFileURL(file).href)
      if (!isPrerenderModule(loaded)) throw new Error(`${file} exports no prerender function`)
      return loaded
    },
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      outDir: { type: 'string', default: 'dist' },
      emptyOutDir: { type: 'boolean', default: false },
    },
  })
  const outDir = resolve(values.outDir)
  // Only an explicit flag overrides Vite's default (empty when outDir is inside the project root).
  const emptyOutDir = values.emptyOutDir ? { emptyOutDir: true } : {}

  await build({ build: { outDir, ...emptyOutDir } })

  const { cacheDir } = await resolveConfig({ logLevel: 'warn' }, 'build')
  const ssr = await buildPrerenderModule(cacheDir)
  try {
    const { prerender } = await ssr.load()
    const shell = await readFile(join(outDir, 'index.html'), 'utf8')
    for (const route of ROUTES) {
      const file = join(outDir, route.file)
      const document = fillShell(
        route.script ? shell : withoutScripts(shell),
        prerender(route.path),
      )
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, document)
      console.log(`prerendered ${route.path} → ${route.file}`)
    }
  } finally {
    await rm(ssr.dir, { recursive: true, force: true })
  }
}

await main()
