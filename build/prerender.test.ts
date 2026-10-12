import { describe, expect, it } from 'vitest'

import { ROUTES, cleanUrl, fillShell, siteOrigin, withoutScripts } from './prerender.ts'

const SHELL =
  '<!doctype html><html><head><meta charset="UTF-8" /><!--app-head--></head>' +
  '<body><div id="root"><!--app-html--></div>' +
  '<script type="module" crossorigin src="/assets/index-abc.js"></script></body></html>'

describe('ROUTES', () => {
  it('pre-renders the root with its script and the Fallback Page without', () => {
    expect(ROUTES).toEqual([
      { path: '/', file: 'index.html', script: true },
      { path: '/exhibits', file: 'exhibits/index.html', script: false },
    ])
  })
})

describe('fillShell', () => {
  it('places the head and the body at the placeholders', () => {
    const html = fillShell(SHELL, { head: '<title>T</title>', body: '<main>M</main>' })
    expect(html).toContain('<meta charset="UTF-8" /><title>T</title></head>')
    expect(html).toContain('<div id="root"><main>M</main></div>')
  })

  it('keeps a $ in the fragments literal', () => {
    expect(fillShell(SHELL, { head: '', body: "$& $' $1" })).toContain(
      '<div id="root">$& $\' $1</div>',
    )
  })

  it('throws naming a missing placeholder', () => {
    expect(() => fillShell('<html><!--app-head--></html>', { head: '', body: '' })).toThrow(
      '<!--app-html-->',
    )
  })
})

describe('withoutScripts', () => {
  it('removes script elements and module preloads and keeps stylesheets', () => {
    const html =
      '<head>\n    <link rel="modulepreload" crossorigin href="/assets/a.js">\n' +
      '    <link rel="stylesheet" crossorigin href="/assets/a.css"></head>' +
      '<body>\n    <script type="module" crossorigin src="/assets/i.js"></script></body>'
    expect(withoutScripts(html)).toBe(
      '<head>\n    <link rel="stylesheet" crossorigin href="/assets/a.css"></head><body></body>',
    )
  })

  it('removes a script element whose end tag carries whitespace', () => {
    expect(withoutScripts('<body><script src="/a.js"></script ></body>')).toBe('<body></body>')
  })

  it('leaves no <script behind for an overlapping input', () => {
    const html = withoutScripts('<p><scr<script>ipt>x</p>')
    expect(html).not.toMatch(/<script/i)
    expect(html).toBe('<p>x</p>')
  })
})

describe('cleanUrl', () => {
  const exists = (relative: string): boolean => relative === 'exhibits/index.html'

  it('serves a clean URL from its directory index', () => {
    expect(cleanUrl('/exhibits', exists)).toBe('/exhibits/index.html')
  })

  it('leaves the root, files and unknown paths alone', () => {
    expect(cleanUrl('/', exists)).toBe('/')
    expect(cleanUrl('/assets/x.js', exists)).toBe('/assets/x.js')
    expect(cleanUrl('/nothing', exists)).toBe('/nothing')
    expect(cleanUrl('/exhibits/', exists)).toBe('/exhibits/')
  })
})

describe('siteOrigin', () => {
  const vercel = {
    VERCEL_URL: 'portfolio-abc.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'thomascova.dev',
  }

  it('is SITE_ORIGIN first, without a trailing slash', () => {
    expect(siteOrigin({ SITE_ORIGIN: 'https://example.test/', ...vercel })).toBe(
      'https://example.test',
    )
  })

  it('is the production domain of a Vercel production build', () => {
    expect(siteOrigin({ VERCEL_ENV: 'production', ...vercel })).toBe('https://thomascova.dev')
  })

  it('is the deployment host of a Vercel preview build', () => {
    expect(siteOrigin({ VERCEL_ENV: 'preview', ...vercel })).toBe(
      'https://portfolio-abc.vercel.app',
    )
  })

  it('is empty elsewhere, so URLs stay relative', () => {
    expect(siteOrigin({})).toBe('')
    expect(siteOrigin({ SITE_ORIGIN: '', VERCEL_URL: '' })).toBe('')
  })
})
