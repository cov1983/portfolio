import { describe, expect, it } from 'vitest'

import { channels, ICE_COLOUR } from '../../src/world/scene/colours'
import { flatten, lumas, percentilePixel, seamless, toIce, type Raster } from './process'

const ICE = channels(ICE_COLOUR)

/** A raster from a function of the pixel's position, the same value in all three channels. */
function raster(width: number, height: number, value: (x: number, y: number) => number): Raster {
  const data = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1)
      data.fill(value(x, y), (y * width + x) * 3, (y * width + x) * 3 + 3)
  }
  return { data, width, height }
}

function channelMeans(image: Raster): number[] {
  return [0, 1, 2].map((c) => {
    let sum = 0
    for (let i = c; i < image.data.length; i += 3) sum += image.data[i] ?? 0
    return sum / (image.data.length / 3)
  })
}

function spread(values: Float64Array): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

/** A faint pattern around 200, like the crop: no channel clamps at 0 or 255. */
const PATTERN = raster(64, 48, (x, y) => 200 + ((x * 7 + y * 13) % 21) - 10)

describe('toIce', () => {
  it('pulls the mean to the ice colour within 1 in every channel, in the sRGB values it holds', () => {
    const means = channelMeans(toIce(PATTERN, ICE, 0.7))
    expect(means.map((m, c) => Math.abs(m - (ICE[c] ?? 0)) <= 1)).toEqual([true, true, true])
  })

  it("keeps k times the input's spread of luma", () => {
    const ratio = spread(lumas(toIce(PATTERN, ICE, 0.7))) / spread(lumas(PATTERN))
    expect(ratio).toBeCloseTo(0.7, 1)
  })

  it('desaturates: every pixel is the ice colour plus one grey offset', () => {
    const out = toIce(PATTERN, ICE, 0.7)
    const offsets = new Set<string>()
    for (let i = 0; i < out.data.length; i += 3) {
      offsets.add([0, 1, 2].map((c) => (out.data[i + c] ?? 0) - (ICE[c] ?? 0)).join(','))
    }
    expect([...offsets].every((o) => new Set(o.split(',')).size === 1)).toBe(true)
  })
})

describe('seamless', () => {
  // A gradient along x and y cannot repeat: its last column is far from its first.
  const gradient = raster(100, 80, (x, y) => x + y)

  function columnStep(image: Raster, x: number, next: number): number {
    let total = 0
    for (let y = 0; y < image.height; y += 1) {
      total += Math.abs(
        (image.data[(y * image.width + next) * 3] ?? 0) -
          (image.data[(y * image.width + x) * 3] ?? 0),
      )
    }
    return total / image.height
  }

  function rowStep(image: Raster, y: number, next: number): number {
    let total = 0
    for (let x = 0; x < image.width; x += 1) {
      total += Math.abs(
        (image.data[(next * image.width + x) * 3] ?? 0) -
          (image.data[(y * image.width + x) * 3] ?? 0),
      )
    }
    return total / image.width
  }

  it('trims the overlap on both axes', () => {
    const tile = seamless(gradient, 16)
    expect([tile.width, tile.height]).toEqual([84, 64])
  })

  it('runs its last column into its first no harder than its columns run into each other', () => {
    const tile = seamless(gradient, 16)
    const inside = Array.from({ length: tile.width - 1 }, (_, x) => columnStep(tile, x, x + 1))
    const mean = inside.reduce((a, b) => a + b, 0) / inside.length
    expect(columnStep(tile, tile.width - 1, 0)).toBeLessThanOrEqual(mean)
  })

  it('runs its last row into its first no harder than its rows run into each other', () => {
    const tile = seamless(gradient, 16)
    const inside = Array.from({ length: tile.height - 1 }, (_, y) => rowStep(tile, y, y + 1))
    const mean = inside.reduce((a, b) => a + b, 0) / inside.length
    expect(rowStep(tile, tile.height - 1, 0)).toBeLessThanOrEqual(mean)
  })

  it('rejects an overlap that does not fit the image', () => {
    expect(() => seamless(gradient, 80)).toThrow('the overlap 80 does not fit the image')
  })
})

describe('percentilePixel', () => {
  it('finds the darkest pixel at 0 and the lightest at 1', () => {
    const ramp = raster(10, 1, (x) => x * 10)
    expect([percentilePixel(ramp, 0), percentilePixel(ramp, 1)]).toEqual([
      [0, 0, 0],
      [90, 90, 90],
    ])
  })
})

describe('flatten', () => {
  // A soft gradient across the tile (40 levels left to right, 20 top to bottom) under fine
  // scratches: a diagonal pattern of ±10 levels with a 21-pixel period; 5 and 13 are coprime with 21
  // and the sizes are multiples of 21, so every column and every row of it averages to zero and the
  // means see only the gradient.
  const WIDTH = 21 * 16
  const HEIGHT = 21 * 8
  const scratches = (x: number, y: number) => ((x * 5 + y * 13) % 21) - 10
  const gradient = (x: number, y: number) => (40 * x) / (WIDTH - 1) + (20 * y) / (HEIGHT - 1)
  const tile = raster(WIDTH, HEIGHT, (x, y) => Math.round(160 + gradient(x, y) + scratches(x, y)))
  const flat = flatten(tile, 40)

  function lineMeans(image: Raster, along: 'column' | 'row'): number[] {
    const grey = lumas(image)
    const count = along === 'column' ? image.width : image.height
    const length = along === 'column' ? image.height : image.width
    return Array.from({ length: count }, (_, i) => {
      let sum = 0
      for (let j = 0; j < length; j += 1) {
        sum += grey[along === 'column' ? j * image.width + i : i * image.width + j] ?? 0
      }
      return sum / length
    })
  }

  const range = (values: number[]) => Math.max(...values) - Math.min(...values)

  it('leaves the column means within 1 level of each other', () => {
    expect(range(lineMeans(flat, 'column'))).toBeLessThanOrEqual(1)
  })

  it('leaves the row means within 1 level of each other', () => {
    expect(range(lineMeans(flat, 'row'))).toBeLessThanOrEqual(1)
  })

  it("keeps the fine scratches' spread", () => {
    const detail = lumas(raster(WIDTH, HEIGHT, (x, y) => 160 + scratches(x, y)))
    expect(spread(lumas(flat)) / spread(detail)).toBeCloseTo(1, 1)
  })

  it('rejects a blur radius that does not fit the image', () => {
    expect(() => flatten(tile, 100)).toThrow('the blur radius 100 does not fit the image')
  })
})
