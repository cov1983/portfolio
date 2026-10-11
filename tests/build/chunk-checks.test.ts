import { describe, expect, it } from 'vitest'

import { scriptSources, staticImports } from './chunk-checks'

describe('scriptSources', () => {
  it('returns the src of every script tag', () => {
    const html =
      '<head><script type="module" crossorigin src="/assets/index-abc.js"></script>' +
      '<link rel="modulepreload" href="/assets/react-def.js"></head>'
    expect(scriptSources(html)).toEqual(['/assets/index-abc.js'])
  })

  it('returns nothing for an inline script', () => {
    expect(scriptSources('<script>alert(1)</script>')).toEqual([])
  })
})

describe('staticImports', () => {
  it('finds the specifiers of static imports in minified code', () => {
    const js =
      'import{a as b,c}from"./react-def.js";import"./side-effect.js";import*as t from"./three-x.js";' +
      'const y=1;export{y}from"./re-export.js";'
    expect(staticImports(js)).toEqual([
      './react-def.js',
      './side-effect.js',
      './three-x.js',
      './re-export.js',
    ])
  })

  it('ignores dynamic imports', () => {
    expect(staticImports('const w=()=>import("./world-abc.js");')).toEqual([])
  })

  it('ignores import.meta', () => {
    expect(staticImports('const u=import.meta.url;')).toEqual([])
  })
})
