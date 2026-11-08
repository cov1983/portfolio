import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadContentFromDisk } from '../../build/content-plugin.ts'
import type { Content } from '../../src/content/types.ts'
import { rootMarkup } from './html-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half for /start (spec increment-2 AC-5.2; plan §6 row 5.2; ADR 0018): the
// document the server sends, read as text without executing anything, is pre-rendered, carries
// its own title and description, and no script. The expected values come from the Content the
// build reads, never literals. The CSP checks shared by every document are in index-html.test.ts.

/** Text and attribute values as React's server renderer escapes them. */
function escaped(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function title(html: string): string | undefined {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1]
}

function description(html: string): string | undefined {
  return /<meta name="description" content="([^"]*)"/.exec(html)?.[1]
}

describe('/start as built (AC-5.2)', () => {
  let build: BuildResult
  let content: Content

  beforeAll(async () => {
    ;[build, content] = await Promise.all([runProductionBuild(), loadContentFromDisk()])
    expect(build.code, build.stderr).toBe(0)
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('holds the Owner’s /start sentence in the page', () => {
    expect(rootMarkup(build.startHtml)).toContain(escaped(content.start.sentence))
  })

  it('holds the Contact', () => {
    expect(rootMarkup(build.startHtml)).toContain(`href="${escaped(content.contact.github)}"`)
  })

  it('holds the "Start a project" section', () => {
    expect(rootMarkup(build.startHtml)).toMatch(
      /<section id="start-a-project"[^>]*>\s*<h2[^>]*>Start a project<\/h2>/,
    )
  })

  it('has its own title', () => {
    expect(title(build.startHtml)).toBe(escaped(`Start a project — ${content.owner.name}`))
    expect(title(build.startHtml)).not.toBe(title(build.indexHtml))
  })

  it('has its own description: the /start sentence', () => {
    expect(description(build.startHtml)).toBe(escaped(content.start.sentence))
    expect(description(build.startHtml)).not.toBe(description(build.indexHtml))
  })

  it('ships no script', () => {
    expect(build.startHtml).not.toMatch(/<script/i)
    expect(build.startHtml).not.toMatch(/modulepreload/i)
  })
})
