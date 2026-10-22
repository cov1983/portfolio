import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dataUrls } from './chunk-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half for #75: Firefox requests /favicon.ico on its own when a document declares
// no icon, and logged a 404 on production (T10 #35). The site ships its own icon, same-origin and
// within the CSP of ADR 0012 (img-src 'self'): public/favicon.svg, linked from both pre-rendered
// documents, and public/favicon.ico, the target of a self-request (an engine without a link, or
// one that ignores SVG icons), generated once from the SVG (the command is in the commit body;
// the #67 redesign replaces both). Vite copies public/ to the output root untouched, so neither
// is ever inlined as a data: URL; the SVG itself is read for one too.
const ICON_LINK =
  /<link\b[^>]*\brel="icon"[^>]*\bhref="\/favicon\.svg"[^>]*\btype="image\/svg\+xml"[^>]*>/
/** ICONDIR: reserved 0, type 1 (an icon, not a cursor); the entry count follows (ICO file format). */
const ICO_MAGIC = Buffer.from([0, 0, 1, 0])

describe('the built site', () => {
  let build: BuildResult
  /** The files at the root of dist/. */
  let files: string[]

  beforeAll(async () => {
    build = await runProductionBuild()
    expect(build.code, build.stderr).toBe(0)
    files = await readdir(build.outDir)
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('carries favicon.svg at the root: an SVG document with no data: URL', async () => {
    expect(files).toContain('favicon.svg')
    const svg = await readFile(join(build.outDir, 'favicon.svg'), 'utf8')
    expect(svg.trimStart()).toMatch(/^<svg\b/)
    expect(dataUrls(svg)).toEqual([])
  })

  it('carries favicon.ico at the root: an ICO with one entry', async () => {
    expect(files).toContain('favicon.ico')
    const ico = await readFile(join(build.outDir, 'favicon.ico'))
    expect(ico.subarray(0, 4)).toEqual(ICO_MAGIC)
    expect(ico.readUInt16LE(4), 'entries').toBe(1)
  })

  it('links the SVG icon from both pre-rendered documents', () => {
    expect(build.indexHtml).toMatch(ICON_LINK)
    expect(build.exhibitsHtml).toMatch(ICON_LINK)
  })
})
