import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { inlineScripts, nonceAttributes, styleAttributes } from './html-checks'
import { removeBuild, runProductionBuild, type BuildResult } from './production-build'

// Seam 1's build half (plan §6). T0's check: the built index.html carries nothing the CSP of
// ADR 0012 would block, and none of the dev-only nonce of vite.config.ts.
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

  it('writes an index.html without an inline script', () => {
    expect(inlineScripts(build.indexHtml)).toEqual([])
  })

  it('writes an index.html without a style attribute', () => {
    expect(styleAttributes(build.indexHtml)).toEqual([])
  })

  it('writes an index.html without a nonce attribute', () => {
    expect(nonceAttributes(build.indexHtml)).toEqual([])
  })
})
