import { randomBytes } from 'node:crypto'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { vercelHeaders } from './vercel-headers.ts'

// Dev only: @vitejs/plugin-react injects the Fast Refresh preamble as an inline <script> and Vite's
// client injects <style> elements (CSS, the error overlay), which `script-src 'self'` and
// `style-src 'self'` block. Vite's `html.cspNonce` puts a nonce on every tag it or a plugin injects
// and the client copies it onto its styles, so the dev copy of the CSP allows that nonce and nothing
// else. The nonce is drawn once per server start; `vite preview` serves dist/ untransformed and the
// delivered site and the built HTML never carry one (Owner decision on #23, 2026-10-11).
const DEV_NONCE = randomBytes(16).toString('base64')
const NONCED_DIRECTIVES = ['script-src', 'style-src']

function withDevNonce(headers: Record<string, string>): Record<string, string> {
  const csp = headers['Content-Security-Policy']
  if (csp === undefined) {
    throw new Error(
      'vercel.json has no Content-Security-Policy header: never a dev server without one',
    )
  }
  const directives = csp.split(';').map((directive) => {
    const name = directive.trim().split(/\s+/)[0]
    return name !== undefined && NONCED_DIRECTIVES.includes(name)
      ? `${directive} 'nonce-${DEV_NONCE}'`
      : directive
  })
  return { ...headers, 'Content-Security-Policy': directives.join(';') }
}

export default defineConfig(({ command, isPreview }) => {
  // ADR 0012: `vite preview` (e2e, perf) and the dev server send the headers of vercel.json, so
  // every run is under the policy the site ships with.
  const headers = vercelHeaders()
  const isDev = command === 'serve' && isPreview !== true
  return {
    plugins: [react()],
    html: isDev ? { cspNonce: DEV_NONCE } : {},
    server: { headers: isDev ? withDevNonce(headers) : headers },
    preview: { headers },
    build: {
      // No source maps in the delivered site (constitution 10: nothing beyond the site's own code).
      sourcemap: false,
    },
  }
})
