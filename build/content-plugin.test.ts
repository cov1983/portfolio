import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

// The dev server half of the content plugin (Owner, #26 Q12): under `vite` the planned media
// files answer at their built URLs, produced on first request. The real content/, a real
// server on an ephemeral port; the plugin itself stays outside the coverage ratchet (plan §6).
describe('the dev server', () => {
  let server: ViteDevServer
  let origin: string

  beforeAll(async () => {
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
    const response = await fetch(`${origin}/media/exhibits/portfolio/workflow-one-page-480.webp`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    expect([metadata.format, metadata.width]).toEqual(['webp', 480])
  }, 30_000)

  it('answers 404 for a file under the media prefix that the build would not write', async () => {
    const response = await fetch(`${origin}/media/exhibits/portfolio/workflow-one-page.png`)
    expect(response.status).toBe(404)
  })
})
