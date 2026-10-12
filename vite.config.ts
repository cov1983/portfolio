import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { contentPlugin } from './build/content-plugin.ts'
import { cleanUrl } from './build/prerender.ts'
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

// The preview mirror of vercel.json's `cleanUrls` (plan §2, Owner on #27 Q1): Vite's preview
// serves exact files and falls back to index.html, so without this `/exhibits` would show the
// Title Screen; Vercel serves exhibits/index.html there. The rewrite runs before Vite's own
// middlewares; the pure rule is in build/prerender.ts. (`/exhibits/` is served here and
// redirected by Vercel, `trailingSlash: false`; the e2e suite uses the clean URL.)
function cleanUrlsPlugin(): Plugin {
  return {
    name: 'portfolio:clean-urls',
    configurePreviewServer(server) {
      const dist = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((req, _res, next) => {
        if (req.url !== undefined) {
          const url = new URL(req.url, 'http://localhost')
          const pathname = cleanUrl(url.pathname, (file) => existsSync(join(dist, file)))
          if (pathname !== url.pathname) req.url = pathname + url.search
        }
        next()
      })
    },
  }
}

export default defineConfig(({ command, isPreview }) => {
  // ADR 0012: `vite preview` (e2e, perf) and the dev server send the headers of vercel.json, so
  // every run is under the policy the site ships with.
  const headers = vercelHeaders()
  const isDev = command === 'serve' && isPreview !== true
  return {
    // ADR 0011: the content is validated, typed as virtual:content and its media emitted by the plugin.
    plugins: [react(), contentPlugin(), cleanUrlsPlugin()],
    html: isDev ? { cspNonce: DEV_NONCE } : {},
    server: { headers: isDev ? withDevNonce(headers) : headers },
    preview: { headers },
    build: {
      // No source maps in the delivered site (constitution 10: nothing beyond the site's own code).
      sourcemap: false,
      rollupOptions: {
        output: {
          // ADR 0010: one `world` chunk holds three, React Three Fiber and Rapier; React stays in
          // the entry chunk (no recursive dependencies). The World's own model and scene travel in
          // the small chunk of the dynamic import that loads them (`World-*.js`): a group matching
          // src/world does not move a dynamic-import entry out of its own chunk (measured in T1).
          // The entry reaches both by dynamic import only; tests/build/chunks.test.ts proves it.
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              { name: 'world', test: /node_modules[\\/](three|@react-three|@dimforge)[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
