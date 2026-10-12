import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { inlineScripts, nonceAttributes, styleAttributes } from './html-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half (plan §6). T0's check on index.html, extended by T4 to both pre-rendered
// documents (ADR 0010): nothing the CSP of ADR 0012 would block, none of the dev-only nonce of
// vite.config.ts, and the Fallback Page carries no script at all (plan §2).
describe('the production build', () => {
  let build: BuildResult

  beforeAll(async () => {
    build = await runProductionBuild()
  })

  afterAll(async () => {
    await removeBuild(build)
  })

  it('exits 0', () => {
    expect(build.code, build.stderr).toBe(0)
  })

  it('writes the Title Screen to index.html and the Fallback Page to exhibits/index.html', () => {
    expect(build.indexHtml).toContain('<div id="root"><main')
    expect(build.exhibitsHtml).toContain('<div id="root"><header>')
  })

  it('reports both documents', () => {
    expect(build.stdout).toContain('prerendered / → index.html')
    expect(build.stdout).toContain('prerendered /exhibits → exhibits/index.html')
  })

  describe.each([
    ['index.html', (b: BuildResult) => b.indexHtml],
    ['exhibits/index.html', (b: BuildResult) => b.exhibitsHtml],
  ])('%s', (_file, html) => {
    it('has no inline script', () => {
      expect(inlineScripts(html(build))).toEqual([])
    })

    it('has no style attribute', () => {
      expect(styleAttributes(html(build))).toEqual([])
    })

    it('has no nonce attribute', () => {
      expect(nonceAttributes(html(build))).toEqual([])
    })
  })

  it('ships no script with the Fallback Page', () => {
    expect(build.exhibitsHtml).not.toMatch(/<script/i)
    expect(build.exhibitsHtml).not.toMatch(/modulepreload/i)
  })

  it('keeps the stylesheet of the Title Screen on the Fallback Page', () => {
    const stylesheets = (html: string): string[] =>
      [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0])
    expect(stylesheets(build.exhibitsHtml)).toEqual(stylesheets(build.indexHtml))
  })
})
