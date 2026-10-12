// `node build/build.ts`: the single build command of `make build` and vercel.json (ADR 0010).
// Vite's client build into the output directory, then an SSR build of src/entry-prerender.tsx,
// then both documents of build/prerender.ts written under the output directory: the Title Screen
// into the client build's index.html, the Fallback Page into a script-free shell that links the
// same stylesheets. I/O glue, outside the coverage ratchet (plan §6); the pure
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

import { ROUTES, fallbackShell, fillShell, siteOrigin, type Fragments } from './prerender.ts'

const PRERENDER_ENTRY = 'src/entry-prerender.tsx'

type PrerenderModule = { prerender: (route: string, origin: string) => Fragments }

function isPrerenderModule(value: unknown): value is PrerenderModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'prerender' in value &&
    typeof value.prerender === 'function'
  )
}

type BuildResult = Awaited<ReturnType<typeof build>>

/** The entry chunk of what `build()` returns, or an error. */
function entryChunk(result: BuildResult) {
  const outputs = Array.isArray(result) ? result : [result]
  for (const output of outputs) {
    if (!('output' in output)) continue
    for (const chunk of output.output) {
      if (chunk.type === 'chunk' && chunk.isEntry) return chunk
    }
  }
  throw new Error('the build produced no entry chunk')
}

/** The stylesheets index.html links: the CSS assets the entry chunk imports, as site paths. */
function entryStylesheets(result: BuildResult): string[] {
  const imported = entryChunk(result).viteMetadata?.importedCss ?? new Set<string>()
  const outputs = Array.isArray(result) ? result : [result]
  return outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((entry) => entry.type === 'asset' && entry.fileName.endsWith('.css'))
    .filter((asset) => imported.has(asset.fileName))
    .map((asset) => `/${asset.fileName}`)
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
  const file = join(dir, entryChunk(result).fileName)
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

  const client = await build({ build: { outDir, ...emptyOutDir } })
  const stylesheets = entryStylesheets(client)

  const { cacheDir } = await resolveConfig({ logLevel: 'warn' }, 'build')
  const ssr = await buildPrerenderModule(cacheDir)
  try {
    const { prerender } = await ssr.load()
    const origin = siteOrigin(process.env)
    const indexShell = await readFile(join(outDir, 'index.html'), 'utf8')
    for (const route of ROUTES) {
      const file = join(outDir, route.file)
      const shell = route.script ? indexShell : fallbackShell(stylesheets)
      const document = fillShell(shell, prerender(route.path, origin))
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, document)
      console.log(`prerendered ${route.path} → ${route.file}`)
    }
  } finally {
    await rm(ssr.dir, { recursive: true, force: true })
  }
}

await main()
