import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

import { EXHIBIT_MEDIA_PREFIX } from '../src/content/images.ts'
import type { Content } from '../src/content/types.ts'
import { loadContentFromDisk } from './content-plugin.ts'

// The dev server half of the content plugin (Owner, #26 Q12): under `vite` the planned media
// files answer at their built URLs, produced on first request. The real content/, a real
// server on an ephemeral port; the URLs come from the Content (plan §6), never from literals; the
// plugin itself stays outside the coverage ratchet (plan §6).
describe('the dev server', () => {
  let server: ViteDevServer
  let origin: string
  let content: Content

  /** The smallest WebP variant of the first image of the first Exhibit. */
  function smallestWebp(): string {
    const srcset = content.exhibits[0]?.images[0]?.sources.find((s) => s.type === 'image/webp')
    const url = srcset?.srcset.split(', ')[0]?.split(' ')[0]
    if (url === undefined) throw new Error('the first Exhibit has no WebP variant')
    return url
  }

  beforeAll(async () => {
    content = await loadContentFromDisk()
    server = await createServer({
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (address === null || address === undefined || typeof address === 'string') {
      throw new Error('the dev server has no port')
    }
    origin = `http://127.0.0.1:${String(address.port)}`
  }, 30_000)

  afterAll(async () => {
    await server.close()
  })

  it('serves a planned image variant with its content type', async () => {
    const url = smallestWebp()
    const response = await fetch(`${origin}${url}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    expect([metadata.format, String(metadata.width)]).toEqual([
      'webp',
      /-(\d+)\.webp$/.exec(url)?.[1],
    ])
  }, 30_000)

  it('answers 404 for a file under the media prefix that the build would not write', async () => {
    const id = content.exhibits[0]?.id ?? 'none'
    const response = await fetch(`${origin}${EXHIBIT_MEDIA_PREFIX}${id}/not-planned.png`)
    expect(response.status).toBe(404)
  })
})
