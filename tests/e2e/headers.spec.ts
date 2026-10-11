import { expect, test } from '@playwright/test'

import vercel from '../../vercel.json' with { type: 'json' }

// ADR 0012: the response headers live in vercel.json and vite.config.ts serves the same array from
// `vite preview`, so this run sees what the Vercel deployment sends. One assertion concept: every
// header of the `/(.*)` entry reaches the browser with its value (header names arrive lower-cased).
const ALL_PATHS = '/(.*)'

function expectedHeaders(): Record<string, string> {
  const entry = vercel.headers.find((h) => h.source === ALL_PATHS)
  if (entry === undefined) {
    throw new Error(`vercel.json has no headers entry for ${ALL_PATHS}`)
  }
  return Object.fromEntries(entry.headers.map((h) => [h.key.toLowerCase(), h.value]))
}

test('the root page carries the response headers of vercel.json', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.headers()).toMatchObject(expectedHeaders())
})
