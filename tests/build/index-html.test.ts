import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadContentFromDisk } from '../../build/content-plugin.ts'
import { App } from '../../src/app/App.tsx'
import { createStore } from '../../src/app/store.ts'
import { inlineScripts, nonceAttributes, rootMarkup, styleAttributes } from './html-checks'
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
    expect(build.indexHtml).toContain('<div id="root"><main class="title-screen">')
    expect(build.exhibitsHtml).toContain('<div id="root"><div class="fallback-page">')
  })

  // T5a (ADR 0010): the markup hydrateRoot adopts is renderToString of the tree the client renders,
  // with the same Content and the same initial state. Production hydration never compares
  // attributes (only text and structure, as React error #418), so this is the attribute half.
  it('holds exactly the markup hydrateRoot renders: renderToString of the same tree with the same Content', async () => {
    const content = await loadContentFromDisk()
    const expected = renderToString(createElement(App, { content, store: createStore() }))
    expect(rootMarkup(build.indexHtml)).toBe(expected)
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

  it('references the stylesheets of the Title Screen on the Fallback Page', () => {
    const stylesheets = (html: string): string[] =>
      [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(
        (m) => m[1] ?? '',
      )
    expect(stylesheets(build.indexHtml)).not.toEqual([])
    expect(stylesheets(build.exhibitsHtml)).toEqual(stylesheets(build.indexHtml))
  })
})
