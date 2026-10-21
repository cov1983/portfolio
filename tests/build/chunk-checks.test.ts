import { describe, expect, it } from 'vitest'

import { dataUrls, scriptSources, staticImports } from './chunk-checks'

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

describe('dataUrls', () => {
  it('reports a base64 data: URL inside minified code', () => {
    const js = 'const i=new Image;i.src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";'
    expect(dataUrls(js)).toEqual(['data:image/png;base64,'])
  })

  it('reports a percent-encoded data: URL inside a stylesheet', () => {
    const css =
      '.ice{background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E")}'
    expect(dataUrls(css)).toEqual(['data:image/svg+xml,'])
  })

  it('ignores a regex literal and prose that mention data:', () => {
    const js = 'const r=/^data:(.*?)(;base64)?,(.*)$/;const note="data: the readings";'
    expect(dataUrls(js)).toEqual([])
  })

  it('ignores a minified object literal whose data property holds a division', () => {
    expect(dataUrls('return{data:e/t,width:n};const o={data:r/255,y:1}')).toEqual([])
  })
})
