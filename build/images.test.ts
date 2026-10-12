import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { planVariants } from '../src/content/images.ts'
import { encodeVariant, encodeVariants, imageDimensions, type EmittedFile } from './images.ts'

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

  it('encodes one planned variant on its own', async () => {
    const variant = plan.variants.find((v) => v.file === 'photo-480.webp')
    if (variant === undefined) throw new Error('no such variant')
    const metadata = await sharp(await encodeVariant(source, variant)).metadata()
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['webp', 480, 240])
  })

  it('writes a JPEG fallback for a jpg source', async () => {
    const jpg = join(dir, 'photo.jpg')
    await writeFile(jpg, await sharp(source).jpeg().toBuffer())
    const outputs = await encodeVariants(
      jpg,
      planVariants('photo.jpg', { width: 60, height: 30 }),
      TARGET,
    )
    const fallback = outputs.find((f) => f.fileName.endsWith('/photo-60.jpg'))
    expect((await sharp(fallback?.source).metadata()).format).toBe('jpeg')
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
