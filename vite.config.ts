import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { BACKDROP_FILE, TOKENS_SOURCE, backdropFiles } from './build/backdrop.ts'
import { contentPlugin } from './build/content-plugin.ts'
import { MARK_SOURCE, faviconFiles, renderPng } from './build/favicon.ts'
import type { EmittedFile } from './build/images.ts'
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

// The files derived from the sources, at the root: the favicon pair from the mark (build/favicon.ts,
// AC-1.3) and the hero's backdrop from the token layer (build/backdrop.ts, AC-2.1). The dev server
// derives each per request, so the icon link, the header mark and the backdrop show under
// `make dev`; in the build, this plugin emits the backdrop into the client bundle and
// build/build.ts writes the favicon pair. `vite preview` serves dist/.
type Derived = { type: string; files: (root: string) => Promise<EmittedFile[]> }

const favicons = (root: string) =>
  readFile(resolve(root, MARK_SOURCE)).then((mark) => faviconFiles(mark, renderPng))
const backdrop = (root: string) =>
  readFile(resolve(root, TOKENS_SOURCE), 'utf8').then((tokens) => backdropFiles(tokens))

const DERIVED: Record<string, Derived> = {
  '/favicon.svg': { type: 'image/svg+xml', files: favicons },
  '/favicon.ico': { type: 'image/x-icon', files: favicons },
  [`/${BACKDROP_FILE}`]: { type: 'image/svg+xml', files: backdrop },
}

function derivedFilesPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'portfolio:derived-files',
    configResolved(config) {
      root = config.root
    },
    // The build emits the backdrop into the client bundle at its fixed name, from the same source
    // as dev; the SSR build of the documents needs no copy.
    async generateBundle() {
      if (this.environment.config.consumer !== 'client') return
      for (const file of await backdrop(root)) {
        this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url === undefined ? '' : new URL(req.url, 'http://localhost').pathname
        const derived = DERIVED[path]
        if (derived === undefined) {
          next()
          return
        }
        derived
          .files(server.config.root)
          .then((files) => {
            const file = files.find((candidate) => `/${candidate.fileName}` === path)
            if (file === undefined) throw new Error(`no derived file for ${path}`)
            res.setHeader('Content-Type', derived.type)
            res.end(file.source)
          })
          .catch(next)
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
    // ADR 0017: Tailwind v4 compiles src/site/site.css (its entry) against the token layer.
    plugins: [react(), tailwindcss(), contentPlugin(), cleanUrlsPlugin(), derivedFilesPlugin()],
    html: isDev ? { cspNonce: DEV_NONCE } : {},
    server: { headers: isDev ? withDevNonce(headers) : headers },
    preview: { headers },
    build: {
      // No source maps in the delivered site (constitution 10: nothing beyond the site's own code).
      sourcemap: false,
      rolldownOptions: {
        // The backdrop is an asset this config's plugin emits at its fixed name in generateBundle
        // (above), after site.css's `url(/hero-backdrop.svg)` is resolved: declared external, the
        // URL stays as written without Vite's "didn't resolve at build time" warning.
        external: [`/${BACKDROP_FILE}`],
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
