import { execFile } from 'node:child_process'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ICO_SIZE } from '../../build/favicon.ts'
import { dataUrls } from './chunk-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half for #75 and AC-1.3 (spec increment-2, D8; plan §6 row 1.3; Owner on #100,
// comments 6705559367 and 6705619580). The Owner's redrawn Puck, src/site/mark.svg, is the one
// drawing of the mark and the favicon: the build derives dist/favicon.svg (its bytes) and
// dist/favicon.ico (a 32 px PNG of it in an ICO directory) from it, and the header mark of both
// pre-rendered documents is an <img> of /favicon.svg, the same emitted file the icon link names.
// No other copy of the drawing exists in the repository. Firefox requests /favicon.ico on its own
// when a document declares no icon (T10 #35), so the ICO stays at the root. Both are same-origin
// files within img-src 'self' (ADR 0012), never data: URLs.
const MARK = fileURLToPath(new URL('../../src/site/mark.svg', import.meta.url))
const REPO = fileURLToPath(new URL('../..', import.meta.url))
const ICON_LINK =
  /<link\b[^>]*\brel="icon"[^>]*\bhref="\/favicon\.svg"[^>]*\btype="image\/svg\+xml"[^>]*>/
/** The header mark: an <img> of /favicon.svg, decorative (alt=""), the Owner's decision on #100. */
const MARK_IMG = /<img\b(?=[^>]*\bsrc="\/favicon\.svg")(?=[^>]*\balt="")[^>]*>/
/** ICONDIR: reserved 0, type 1 (an icon, not a cursor); the entry count follows (ICO format). */
const ICO_MAGIC = Buffer.from([0, 0, 1, 0])
/** The ICONDIR (6 bytes) and one ICONDIRENTRY (16 bytes) before the one image's data. */
const ICO_HEADER_BYTES = 22

/** The raw RGBA pixels of a PNG, for a comparison that does not depend on the encoder's bytes. */
async function pixels(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().raw().toBuffer()
}

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

  it('carries favicon.svg at the root: an SVG document', async () => {
    expect(files).toContain('favicon.svg')
    const svg = await readFile(join(build.outDir, 'favicon.svg'), 'utf8')
    expect(svg.trimStart()).toMatch(/^<svg\b/)
  })

  it('derives favicon.svg from src/site/mark.svg, byte for byte', async () => {
    const [built, mark] = await Promise.all([
      readFile(join(build.outDir, 'favicon.svg')),
      readFile(MARK),
    ])
    expect(built.equals(mark)).toBe(true)
  })

  it('inlines nothing in favicon.svg as a data: URL', async () => {
    expect(dataUrls(await readFile(join(build.outDir, 'favicon.svg'), 'utf8'))).toEqual([])
  })

  it('carries favicon.ico at the root: an ICO with at least one entry', async () => {
    expect(files).toContain('favicon.ico')
    const ico = await readFile(join(build.outDir, 'favicon.ico'))
    expect(ico.subarray(0, 4)).toEqual(ICO_MAGIC)
    expect(ico.readUInt16LE(4), 'entries').toBeGreaterThanOrEqual(1)
  })

  it('derives favicon.ico from src/site/mark.svg: its image is the mark at 32 px, pixel for pixel', async () => {
    const ico = await readFile(join(build.outDir, 'favicon.ico'))
    const png = ico.subarray(ICO_HEADER_BYTES)
    const expected = await sharp(await readFile(MARK))
      .resize(ICO_SIZE, ICO_SIZE)
      .png()
      .toBuffer()
    expect((await pixels(png)).equals(await pixels(expected))).toBe(true)
  })

  it('links the SVG icon from both pre-rendered documents', () => {
    expect(build.indexHtml).toMatch(ICON_LINK)
    expect(build.exhibitsHtml).toMatch(ICON_LINK)
  })

  it('shows the mark as a decorative image of /favicon.svg in both pre-rendered documents', () => {
    expect(build.indexHtml).toMatch(MARK_IMG)
    expect(build.exhibitsHtml).toMatch(MARK_IMG)
  })
})

describe('the repository', () => {
  it('holds the mark’s drawing once: no other file carries its path data', async () => {
    const mark = await readFile(MARK, 'utf8')
    const paths = [...mark.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1] ?? '')
    expect(paths).not.toEqual([])
    // Tracked and untracked files alike, the ignored ones (dist/, node_modules/) aside.
    const { stdout } = await promisify(execFile)(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: REPO, maxBuffer: 16 * 1024 * 1024 },
    )
    const others = stdout.split('\0').filter((file) => file !== '' && file !== 'src/site/mark.svg')
    const copies: string[] = []
    for (const file of others) {
      // Regular files only: a symlink (.claude/skills/* point at directories) is a link, not a
      // copy, and a tracked file deleted in the worktree is listed but gone. Any other error is
      // the test's to report.
      const kind = await lstat(join(REPO, file)).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
        throw error
      })
      if (kind === null || !kind.isFile()) continue
      const text = await readFile(join(REPO, file), 'utf8')
      if (paths.some((d) => text.includes(d))) copies.push(file)
    }
    expect(copies).toEqual([])
  })
})
