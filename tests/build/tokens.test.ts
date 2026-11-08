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
// read custom properties, and are tied to the tokens they draw by the cases below. There is no
// light theme: no `prefers-color-scheme` anywhere (D3, D5). The hero's backdrop, which the build
// derives (build/backdrop.ts; Owner, #103 comment 6726409397), is a standalone file too: the
// emitted dist/hero-backdrop.svg holds the token values it was built from and no other colour. The World chunk's own stylesheet
// (src/world/scene/world.css) is outside "HTML surface" and not linked by the documents; its canvas
// background reads var(--color-background), proven in the browser by tests/e2e/look.spec.ts.
const SITE_DIR = fileURLToPath(new URL('../../src/site/', import.meta.url))
/** The token layer and the mark's drawing: the only sources of src/site/ that may hold a literal. */
const TOKEN_LAYER = 'tokens.css'
const DECLARED = new Set([TOKEN_LAYER, 'mark.svg'])
const STYLESHEET_LINK = /<link\b[^>]*rel="stylesheet"[^>]*\bhref="\/([^"]+)"/g

/** A token's value in tokens.css, lowercased. */
async function tokenValue(name: string): Promise<string> {
  const tokens = await readFile(join(SITE_DIR, TOKEN_LAYER), 'utf8')
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]+);`, 'i').exec(tokens)
  if (match?.[1] === undefined) throw new Error(`tokens.css has no --color-${name}`)
  return match[1].toLowerCase()
}

/** The hex values of one attribute in an SVG, lowercased, in source order. */
function hexAttributes(svg: string, attribute: string): string[] {
  const pattern = new RegExp(`\\s${attribute}="(#[0-9a-f]+)"`, 'gi')
  return [...svg.matchAll(pattern)].map((match) => (match[1] ?? '').toLowerCase())
}

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

  // The derived backdrop draws each of its four colours from the token layer by role, so a tuned
  // token is followed by the next build, and a colour written into build/backdrop.ts fails here.
  describe('hero-backdrop.svg', () => {
    let svg: string
    beforeAll(async () => {
      svg = await readFile(join(build.outDir, 'hero-backdrop.svg'), 'utf8')
    })

    it('uses no colour but the background, border, primary and glow tokens', async () => {
      const tokens = new Set(
        await Promise.all(['background', 'border', 'primary', 'glow'].map(tokenValue)),
      )
      const literals = hexAndFunctionLiterals(svg).map((literal) => literal.toLowerCase())
      expect(new Set(literals)).toEqual(tokens)
    })

    it('draws the grid in the border token and the crosses in the primary token', async () => {
      expect(hexAttributes(svg, 'stroke')).toEqual([
        await tokenValue('border'),
        await tokenValue('primary'),
      ])
    })

    it('draws the edge glow in the glow token and fades its foot by the background token', async () => {
      expect(hexAttributes(svg, 'stop-color')).toEqual([
        await tokenValue('glow'),
        await tokenValue('glow'),
        await tokenValue('background'),
        await tokenValue('background'),
      ])
    })
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
        : hexAndFunctionLiterals(withoutComments(text, file))
      found.push(...literals.map((literal) => `${file}: ${literal}`))
    }
    expect(found).toEqual([])
  })

  // The mark's drawing keeps its colours literal (the favicon is a standalone file), so it is tied
  // to the tokens it draws (ai-review round 1 on #121, finding 2): a tuned accent or disc colour
  // in tokens.css fails here until mark.svg follows.
  it("draws the mark's rim and gloss in the primary token", async () => {
    const svg = await readFile(join(SITE_DIR, 'mark.svg'), 'utf8')
    const accents = [...hexAttributes(svg, 'stroke'), ...hexAttributes(svg, 'stop-color')]
    expect(accents.length).toBeGreaterThan(0)
    expect(new Set(accents)).toEqual(new Set([await tokenValue('primary')]))
  })

  // Any colour form in the drawing (a style attribute, color=, flood-color=, a <style> block, a
  // colour function), not only the three attributes the role cases read (ai-review round 2 on
  // #121, finding 1): a stray colour would reach the favicon untied.
  it('uses no colour in the mark but the primary and primary-foreground tokens', async () => {
    const svg = await readFile(join(SITE_DIR, 'mark.svg'), 'utf8')
    const tokens = new Set([await tokenValue('primary'), await tokenValue('primary-foreground')])
    const literals = hexAndFunctionLiterals(svg).map((literal) => literal.toLowerCase())
    expect(literals.length).toBeGreaterThan(0)
    expect(literals.filter((literal) => !tokens.has(literal))).toEqual([])
  })

  it("fills the mark's disc with the primary-foreground token", async () => {
    const svg = await readFile(join(SITE_DIR, 'mark.svg'), 'utf8')
    expect(hexAttributes(svg, 'fill')).toEqual([await tokenValue('primary-foreground')])
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
