import { readFile } from 'node:fs/promises'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { contrastRatio, INK } from '../../src/world/scene/colours'
import { ICE_PIXELS } from '../../src/world/scene/ice'
import { MAX_BYTES, percentilePixel } from './process'

// The committed ice texture (`make ice-texture`, #55): what the World downloads before it is
// playable and what the Banner's ink lies on. Byte equality across machines is not asserted:
// libvips' WebP output may differ by version.
const TEXTURE = 'src/world/scene/ice.webp'

async function pixels() {
  const { data, info } = await sharp(TEXTURE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data), width: info.width, height: info.height }
}

describe('The ice texture', () => {
  it('is a WebP image', async () => {
    expect((await sharp(TEXTURE).metadata()).format).toBe('webp')
  })

  it('is at most 150,000 bytes', async () => {
    expect((await readFile(TEXTURE)).length).toBeLessThanOrEqual(MAX_BYTES)
  })

  it('is the size the World maps it at (ICE_PIXELS)', async () => {
    const { width, height } = await sharp(TEXTURE).metadata()
    expect({ width, height }).toEqual(ICE_PIXELS)
  })

  it("keeps the Banner's ink at 7:1 or more on its darkest percentile (Q4 on #55)", async () => {
    expect(contrastRatio(INK, percentilePixel(await pixels(), 0.01))).toBeGreaterThanOrEqual(7)
  })
})
