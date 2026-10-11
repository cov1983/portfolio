import { describe, expect, it } from 'vitest'

import { inlineScripts, nonceAttributes, styleAttributes } from './html-checks'

describe('inlineScripts', () => {
  it('reports a script tag without src', () => {
    expect(inlineScripts('<head><script type="module">run()</script></head>')).toEqual([
      '<script type="module">',
    ])
  })

  it('accepts a script tag with src', () => {
    expect(inlineScripts('<script type="module" crossorigin src="/assets/a.js"></script>')).toEqual(
      [],
    )
  })
})

describe('styleAttributes', () => {
  it('reports a tag with a style attribute', () => {
    expect(styleAttributes('<div id="root" style="height: 60vh"></div>')).toEqual([
      '<div id="root" style="height: 60vh">',
    ])
  })

  it('accepts tags without a style attribute', () => {
    expect(
      styleAttributes('<link rel="stylesheet" href="/assets/a.css"><div class="root">'),
    ).toEqual([])
  })
})

describe('nonceAttributes', () => {
  it('reports a tag with a nonce attribute', () => {
    expect(nonceAttributes('<script type="module" nonce="abc" src="/a.js"></script>')).toEqual([
      '<script type="module" nonce="abc" src="/a.js">',
    ])
  })

  it('accepts tags without a nonce attribute', () => {
    expect(nonceAttributes('<meta property="csp" content="nonce=x"><script src="/a.js">')).toEqual(
      [],
    )
  })
})
