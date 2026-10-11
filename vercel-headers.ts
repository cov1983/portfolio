import vercel from './vercel.json' with { type: 'json' }

// ADR 0012: the response headers live in vercel.json and nowhere else. vite.config.ts serves this
// array from `vite preview` and the dev server; the e2e fixture asserts it on the served page.
const ALL_PATHS = '/(.*)'

/** The `/(.*)` headers of vercel.json as a record; a missing entry is an error, never no policy. */
export function vercelHeaders(): Record<string, string> {
  const entry = vercel.headers.find((h) => h.source === ALL_PATHS)
  if (entry === undefined) {
    throw new Error(`vercel.json has no headers entry for ${ALL_PATHS}`)
  }
  return Object.fromEntries(entry.headers.map((h) => [h.key, h.value]))
}
