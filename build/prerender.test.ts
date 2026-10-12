import { describe, expect, it } from 'vitest'

import { ROUTES, cleanUrl, fallbackShell, fillShell, siteOrigin } from './prerender.ts'

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

describe('fallbackShell', () => {
  const shell = fallbackShell(['/assets/index-abc.css', '/assets/site-def.css'])

  it('is a complete document with both placeholders', () => {
    expect(shell).toMatch(/^<!doctype html>\n<html lang="en">/)
    expect(shell).toContain('<meta charset="UTF-8" />')
    expect(shell).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    )
    expect(shell).toContain('<!--app-head-->\n  </head>')
    expect(shell).toContain('<div id="root"><!--app-html--></div>')
  })

  it('links every stylesheet by its href, in order', () => {
    expect([...shell.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1])).toEqual(
      ['/assets/index-abc.css', '/assets/site-def.css'],
    )
  })

  it('holds no script', () => {
    expect(shell).not.toMatch(/<script/i)
    expect(fallbackShell([])).not.toMatch(/<script/i)
  })

  it('is filled like index.html', () => {
    const html = fillShell(shell, { head: '<title>T</title>', body: '<main>M</main>' })
    expect(html).toContain('<title>T</title>\n  </head>')
    expect(html).toContain('<div id="root"><main>M</main></div>')
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
