import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { planVariants } from '../src/content/images.ts'
import { encodeVariants, imageDimensions, type EmittedFile } from './images.ts'

// AC-27.1, the encode half: the files planVariants names exist with the planned width and format.
// A generated 1000 × 500 PNG in the scratch dir (never the worktree, ADR 0008); sharp decodes the
// outputs back, so the proof is the pixels' metadata, not the file names alone.
const TARGET = 'media/exhibits/sample'
const METADATA_FORMAT: Record<string, string> = { avif: 'heif', webp: 'webp', png: 'png' }

describe('encodeVariants', () => {
  let dir: string
  let source: string
  let files: EmittedFile[]
  const plan = planVariants('photo.png', { width: 1000, height: 500 })

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'portfolio-images-'))
    source = join(dir, 'photo.png')
    await writeFile(
      source,
      await sharp({ create: { width: 1000, height: 500, channels: 3, background: '#4080c0' } })
        .png()
        .toBuffer(),
    )
    files = await encodeVariants(source, plan, TARGET)
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('encodes avif and webp at every planned width', () => {
    const names = files.map((f) => f.fileName).sort()
    expect(names).toEqual([
      `${TARGET}/photo-1000.avif`,
      `${TARGET}/photo-1000.png`,
      `${TARGET}/photo-1000.webp`,
      `${TARGET}/photo-480.avif`,
      `${TARGET}/photo-480.webp`,
      `${TARGET}/photo-960.avif`,
      `${TARGET}/photo-960.webp`,
    ])
  })

  it('writes the fallback in the source format at the largest width', async () => {
    const fallback = files.find((f) => f.fileName.endsWith('/photo-1000.png'))
    const metadata = await sharp(fallback?.source).metadata()
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['png', 1000, 500])
  })

  it('decodes every output to its planned width, height and format', async () => {
    for (const planned of plan.variants) {
      const file = files.find((f) => f.fileName === `${TARGET}/${planned.file}`)
      const metadata = await sharp(file?.source).metadata()
      expect([metadata.width, metadata.height, metadata.format], planned.file).toEqual([
        planned.width,
        planned.height,
        METADATA_FORMAT[planned.format],
      ])
    }
  })

  it('reads the dimensions of a source', async () => {
    await expect(imageDimensions(source)).resolves.toEqual({ width: 1000, height: 500 })
  })

  it('rejects a file that is not an image', async () => {
    const text = join(dir, 'not-an-image.png')
    await writeFile(text, 'not a png')
    await expect(imageDimensions(text)).rejects.toThrow()
  })
})
