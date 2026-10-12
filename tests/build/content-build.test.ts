import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadContentFromDisk } from '../../build/content-plugin.ts'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build.ts'

// Seam 1's build half for the content pipeline (plan §6, AC-26.1/26.2/26.3/27.1): the production
// build spawned with CONTENT_DIR pointing at a fixture, exit status and stderr checked as text.
// The real content/ builds; each fixture under tests/fixtures/content-<case>/ is the Owner's tree
// with one defect and fails naming file and field or reference.
const FIXTURES = 'tests/fixtures'
const SAMPLE_INDEX = 'exhibits/sample/index.md'

function fixtureBuild(name: string): Promise<BuildResult> {
  return runProductionBuild({ env: { CONTENT_DIR: `${FIXTURES}/content-${name}` } })
}

function failingFixture(name: string, mention: string, where = SAMPLE_INDEX): void {
  describe(`fixture ${name}`, () => {
    let build: BuildResult

    beforeAll(async () => {
      build = await fixtureBuild(name)
    })

    afterAll(async () => {
      await removeBuild(build)
    })

    it('exits 1', () => {
      expect(build.code).toBe(1)
    })

    it(`names the file and ${mention}`, () => {
      expect(build.stderr).toContain(`${FIXTURES}/content-${name}/${where}: ${mention}`)
    })
  })
}

describe('the real content', () => {
  let build: BuildResult
  let media: string[]

  beforeAll(async () => {
    build = await runProductionBuild()
    media =
      build.code === 0 ? await readdir(join(build.outDir, 'media', 'exhibits', 'portfolio')) : []
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('builds', () => {
    expect(build.code, build.stderr).toBe(0)
  })

  it('emits avif and webp at 480, 960 and 1440 under media/exhibits/portfolio/', () => {
    for (const width of [480, 960, 1440]) {
      expect(media).toContain(`workflow-one-page-${String(width)}.avif`)
      expect(media).toContain(`workflow-one-page-${String(width)}.webp`)
    }
  })

  it('emits the png fallback at 1440', () => {
    expect(media).toContain('workflow-one-page-1440.png')
  })

  it('does not emit the original file name', () => {
    expect(media).not.toContain('workflow-one-page.png')
    expect(media).toHaveLength(7)
  })

  it('prints the content summary', () => {
    expect(build.stdout).toContain('content: 1 Exhibit (portfolio)')
  })
})

failingFixture('missing-field', 'images[0].alt: required')
failingFixture('bad-visibility', 'visibility: Invalid option')

describe('fixture html-in-summary', () => {
  let build: BuildResult

  beforeAll(async () => {
    build = await fixtureBuild('html-in-summary')
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('builds', () => {
    expect(build.code, build.stderr).toBe(0)
  })

  // Nothing renders content before T4, so the proof reads the fixture through the plugin's own
  // disk facade (Owner, #26 Q7); T4 turns it into a check on dist/exhibits/index.html.
  it('renders the script tag of the summary as text', async () => {
    const { exhibits } = await loadContentFromDisk(`${FIXTURES}/content-html-in-summary`)
    expect(exhibits[0]?.summaryHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(exhibits[0]?.summaryHtml).not.toContain('<script')
  })
})

failingFixture('missing-image', 'images[0].src: absent.png not found')
failingFixture('missing-poster', 'video.poster: absent.png not found')
failingFixture('bad-internal-link', 'links[0].url: /exhibits#nope is not a built route')
failingFixture('unreadable-image', 'unreadable image (', 'exhibits/sample/photo.png')
