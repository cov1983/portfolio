import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scriptSources, staticImports } from './chunk-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half (plan §7, ADR 0010): the `world` chunk holds three, React Three Fiber and
// Rapier, and the entry chunk never imports it statically, so nothing of the World evaluates on the
// Title Screen path. The markers are strings each library leaves in its bundle: three sets
// `globalThis.__THREE__`, Rapier's inlined wasm is instantiated through `WebAssembly`.
const WORLD_CHUNK = /^world-.*\.js$/
/** The library chunk or the World's own code (`World-*.js`, the dynamic import's module). */
const ANY_WORLD_CHUNK = /^world-.*\.js$/i
const MARKERS = { three: '__THREE__', rapier: 'WebAssembly' }
/** A key only the content JSON of virtual:content holds (src/content/types.ts). */
const CONTENT_MARKER = 'emailHrefEntities'

/** Every file reachable from `entry` through static imports, `entry` included; absolute paths. */
async function staticImportClosure(entry: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()
    if (file === undefined || files.has(file)) continue
    const source = await readFile(file, 'utf8')
    files.set(file, source)
    for (const specifier of staticImports(source)) {
      pending.push(resolve(dirname(file), specifier))
    }
  }
  return files
}

describe('the built chunks', () => {
  let build: BuildResult
  let entryFile: string
  let worldChunks: string[]

  beforeAll(async () => {
    build = await runProductionBuild()
    expect(build.code, build.stderr).toBe(0)
    const [source, ...more] = scriptSources(build.indexHtml)
    expect(source, 'index.html references one module script').toBeDefined()
    expect(more).toEqual([])
    entryFile = join(build.outDir, source ?? '')
    worldChunks = (await readdir(join(build.outDir, 'assets'))).filter((f) => WORLD_CHUNK.test(f))
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('does not reference the world chunk from index.html', () => {
    expect(build.indexHtml).not.toMatch(/world-/i)
  })

  it('emits exactly one world chunk', () => {
    expect(worldChunks).toHaveLength(1)
  })

  it('puts three and Rapier into the world chunk', async () => {
    const source = await readFile(join(build.outDir, 'assets', worldChunks[0] ?? ''), 'utf8')
    expect(source).toContain(MARKERS.three)
    expect(source).toContain(MARKERS.rapier)
  })

  it('never reaches a World chunk through the static imports of the entry chunk', async () => {
    const closure = await staticImportClosure(entryFile)
    const reached = [...closure.keys()].filter((f) =>
      ANY_WORLD_CHUNK.test(f.split('/').pop() ?? ''),
    )
    expect(reached).toEqual([])
  })

  // Owner on #27 Q4 ended with T5a: hydration renders from virtual:content, so the content JSON
  // travels in the entry chunk's static closure and the Title Screen hydrates without a request.
  it('carries the content JSON in the entry chunk or its static imports', async () => {
    const closure = await staticImportClosure(entryFile)
    expect([...closure.values()].some((source) => source.includes(CONTENT_MARKER))).toBe(true)
  })

  it('keeps three and Rapier out of the entry chunk and its static imports', async () => {
    const closure = await staticImportClosure(entryFile)
    for (const [file, source] of closure) {
      expect(source, file).not.toContain(MARKERS.three)
      expect(source, file).not.toContain(MARKERS.rapier)
    }
  })
})
