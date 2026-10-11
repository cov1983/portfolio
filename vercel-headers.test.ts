import { describe, expect, it } from 'vitest'

import { vercelHeaders } from './vercel-headers.ts'

// Pins what ADR 0012 decided, so a weakened vercel.json fails a gate and not only CODEOWNERS
// review: the five headers exist, the CSP denies by default, carries no 'unsafe-inline' or
// 'unsafe-eval', and 'wasm-unsafe-eval' (the single relaxation, for Rapier) is on script-src only.
const HEADER_NAMES = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
]

/** The CSP as directive name → source tokens. */
function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter((tokens) => tokens[0] !== undefined && tokens[0] !== '')
      .map((tokens) => [tokens[0] ?? '', tokens.slice(1)]),
  )
}

function csp(): Map<string, string[]> {
  return directives(vercelHeaders()['Content-Security-Policy'] ?? '')
}

describe('the response headers of vercel.json', () => {
  it('carry the five headers of ADR 0012', () => {
    expect(Object.keys(vercelHeaders()).sort()).toEqual([...HEADER_NAMES].sort())
  })

  it('deny every resource type by default', () => {
    expect(csp().get('default-src')).toEqual(["'none'"])
  })

  it("allow neither 'unsafe-inline' nor 'unsafe-eval' anywhere", () => {
    const tokens = [...csp().values()].flat()
    expect(tokens.filter((t) => t === "'unsafe-inline'" || t === "'unsafe-eval'")).toEqual([])
  })

  it("relax script-src alone, with 'wasm-unsafe-eval'", () => {
    const relaxed = [...csp()].filter(([, tokens]) => tokens.includes("'wasm-unsafe-eval'"))
    expect(relaxed.map(([name]) => name)).toEqual(['script-src'])
  })
})
