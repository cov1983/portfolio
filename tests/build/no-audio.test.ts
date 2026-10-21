import { readdir } from 'node:fs/promises'
import { extname } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half of AC-28.3 (plan §6 row 28.3, T9 #34): the production build holds no audio
// file and neither pre-rendered document carries an audio element or an audio source. The browser
// half (no AudioContext constructed, no media request, no audio response) is the full-visit
// journey in tests/e2e/privacy.spec.ts. The World chunk names AudioContext in its text (three's
// audio module is not tree-shaken), so this seam checks files and markup, never the chunks' text.
const AUDIO_EXTENSIONS = [
  '.mp3',
  '.ogg',
  '.oga',
  '.wav',
  '.flac',
  '.aac',
  '.m4a',
  '.opus',
  '.weba',
  '.mid',
  '.midi',
]

describe('the built site', () => {
  let build: BuildResult
  /** Every path under dist/, relative, directories included. */
  let files: string[]

  beforeAll(async () => {
    build = await runProductionBuild()
    expect(build.code, build.stderr).toBe(0)
    files = await readdir(build.outDir, { recursive: true })
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('lists both documents and the ice texture, so the walk below is not empty', () => {
    expect(files).toContain('index.html')
    expect(files).toContain('exhibits/index.html')
    expect(files.some((file) => /^assets\/ice-[^/]*\.webp$/.test(file))).toBe(true)
  })

  it('holds no audio file (AC-28.3)', () => {
    const audio = files.filter((file) => AUDIO_EXTENSIONS.includes(extname(file).toLowerCase()))
    expect(audio).toEqual([])
  })

  it('renders no audio element and no audio source on either document (AC-28.3)', () => {
    for (const html of [build.indexHtml, build.exhibitsHtml]) {
      expect(html).not.toMatch(/<audio\b/i)
      expect(html).not.toMatch(/type="audio\//i)
    }
  })
})
