import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half for AC-16.3 (spec increment-2, D4; plan §6 row 16.3, ADR 0017): the site
// delivers one font file, a Latin-subset variable woff2 under 100 KB, served from its own origin.
// Fontsource's own stylesheets declare every subset (five woff2 for one family), so the site
// declares its own Latin @font-face (src/site/site.css); this test fails the build that ships more.
/** AC-16.3's limit: under 100 KB, read as 100,000 bytes. */
const MAX_FONT_BYTES = 100_000
/** Fontsource's file name for the Latin subset of a variable family's weight axis, upright. */
const LATIN_VARIABLE = /-latin-wght-normal-[\w-]+\.woff2$/

describe('the built site', () => {
  let build: BuildResult
  /** Every .woff2 under the output directory, as paths relative to it. */
  let fonts: string[]

  beforeAll(async () => {
    build = await runProductionBuild()
    expect(build.code, build.stderr).toBe(0)
    const files = await readdir(build.outDir, { recursive: true })
    fonts = files.filter((file) => file.endsWith('.woff2'))
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('delivers exactly one woff2', () => {
    expect(fonts).toHaveLength(1)
  })

  it('delivers the Latin subset of a variable family', () => {
    expect(fonts.map((file) => basename(file))).toEqual([expect.stringMatching(LATIN_VARIABLE)])
  })

  it('keeps that woff2 under 100,000 bytes', async () => {
    const sizes = await Promise.all(
      fonts.map(async (file) => (await stat(join(build.outDir, file))).size),
    )
    expect(sizes).toEqual([expect.any(Number)])
    for (const size of sizes) expect(size).toBeLessThan(MAX_FONT_BYTES)
  })
})
