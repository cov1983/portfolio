import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  colourLiterals,
  hasColourSchemeQuery,
  hexAndFunctionLiterals,
  tokenDeclarations,
  withoutComments,
} from './css-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half for AC-1.1 (plan §6 row 1.1, ADR 0017): every colour of the HTML surfaces
// comes from the one token set. In the stylesheets the pre-rendered documents link, no colour
// literal stands outside a `--color-*` declaration; in src/site/ no source but the token layer
// (tokens.css) holds one, with the one declared exception: the mark's drawing src/site/mark.svg,
// whose colours are literal because the favicon derived from it is a standalone file that cannot
// read custom properties. There is no light theme: no `prefers-color-scheme` anywhere (D3, D5).
// The World chunk's own stylesheet (src/world/scene/world.css) is a World scene colour, outside
// "HTML surface", and is not linked by the documents.
const SITE_DIR = fileURLToPath(new URL('../../src/site/', import.meta.url))
/** The token layer and the mark's drawing: the only sources of src/site/ that may hold a literal. */
const TOKEN_LAYER = 'tokens.css'
const DECLARED = new Set([TOKEN_LAYER, 'mark.svg'])
const STYLESHEET_LINK = /<link\b[^>]*rel="stylesheet"[^>]*\bhref="\/([^"]+)"/g

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
}

describe('the built site', () => {
  let build: BuildResult
  /** The text of each stylesheet index.html links, by its path under dist/. */
  let stylesheets: Map<string, string>

  beforeAll(async () => {
    build = await runProductionBuild()
    expect(build.code, build.stderr).toBe(0)
    const paths = [...build.indexHtml.matchAll(STYLESHEET_LINK)].map((match) => match[1] ?? '')
    stylesheets = new Map(
      await Promise.all(
        paths.map(
          async (path) => [path, await readFile(join(build.outDir, path), 'utf8')] as const,
        ),
      ),
    )
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('links at least one stylesheet from index.html', () => {
    expect([...stylesheets.keys()]).not.toEqual([])
  })

  it('has no colour literal outside the --color-* tokens in the linked stylesheets', () => {
    const found = [...stylesheets].flatMap(([path, css]) =>
      colourLiterals(css).map((literal) => `${path}: ${literal}`),
    )
    expect(found).toEqual([])
  })

  it('has no prefers-color-scheme query in the linked stylesheets', () => {
    const found = [...stylesheets].filter(([, css]) => hasColourSchemeQuery(css)).map(([p]) => p)
    expect(found).toEqual([])
  })
})

describe('src/site/', () => {
  // The token layer is tokens.css alone: a `--color-*` declared in another stylesheet (a scoped
  // override, a second token set) passes the literal search, so it is reported on its own.
  it('declares --color-* tokens only in tokens.css', async () => {
    const files = (await filesUnder(SITE_DIR)).filter(
      (file) => file.endsWith('.css') && file !== TOKEN_LAYER,
    )
    const found: string[] = []
    for (const file of files) {
      const declared = tokenDeclarations(await readFile(join(SITE_DIR, file), 'utf8'))
      found.push(...declared.map((property) => `${file}: ${property}`))
    }
    expect(found).toEqual([])
  })

  it('holds colour literals only in tokens.css and the declared mark.svg', async () => {
    const files = (await filesUnder(SITE_DIR)).filter((file) => !DECLARED.has(file))
    const found: string[] = []
    for (const file of files) {
      const text = await readFile(join(SITE_DIR, file), 'utf8')
      // A stylesheet is read declaration by declaration, named colours included; a component's
      // code (its comments dropped: an issue number like #100 is valid hex) is searched for hex
      // colours and colour functions only, since its prose may use a colour word.
      const literals = file.endsWith('.css')
        ? colourLiterals(text)
        : hexAndFunctionLiterals(withoutComments(text))
      found.push(...literals.map((literal) => `${file}: ${literal}`))
    }
    expect(found).toEqual([])
  })

  it('has no prefers-color-scheme query in any source', async () => {
    const files = await filesUnder(SITE_DIR)
    const found: string[] = []
    for (const file of files) {
      if (hasColourSchemeQuery(await readFile(join(SITE_DIR, file), 'utf8'))) found.push(file)
    }
    expect(found).toEqual([])
  })
})
