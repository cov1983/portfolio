// The ice texture's pixel steps (#55), pure, on raw interleaved 8-bit sRGB (3 channels): the values
// the WebP file holds and the scene samples with SRGBColorSpace. scripts/ice-texture.ts does the I/O.

export type Raster = { data: Uint8Array; width: number; height: number }
export type Rgb = readonly [r: number, g: number, b: number]

const CHANNELS = 3

/** Rec. 709 luma of 8-bit sRGB values: the grey a pixel desaturates to. */
function luma(data: Uint8Array, i: number): number {
  return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0)
}

/** Every pixel's luma, in order. */
export function lumas(raster: Raster): Float64Array {
  const out = new Float64Array(raster.width * raster.height)
  for (let p = 0; p < out.length; p += 1) out[p] = luma(raster.data, p * CHANNELS)
  return out
}

function mean(values: Float64Array): number {
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

/**
 * Desaturated and pulled towards the ice colour: each pixel becomes `target + k·(luma − mean)` in
 * every channel, so the image keeps its skate marks as small departures from the ice's own tint,
 * with `k` < 1 lowering their contrast. Clamped to 0…255 and rounded.
 */
export function toIce(raster: Raster, target: Rgb, k: number): Raster {
  const grey = lumas(raster)
  const centre = mean(grey)
  const data = new Uint8Array(raster.data.length)
  grey.forEach((g, p) => {
    for (let c = 0; c < CHANNELS; c += 1) {
      const value = (target[c] ?? 0) + k * (g - centre)
      data[p * CHANNELS + c] = Math.min(255, Math.max(0, Math.round(value)))
    }
  })
  return { data, width: raster.width, height: raster.height }
}

function transpose(raster: Raster): Raster {
  const { width, height } = raster
  const data = new Uint8Array(raster.data.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < CHANNELS; c += 1) {
        data[(x * height + y) * CHANNELS + c] = raster.data[(y * width + x) * CHANNELS + c] ?? 0
      }
    }
  }
  return { data, width: height, height: width }
}

/**
 * Seamless along x: the tile keeps the first `width − overlap` columns, and its first `overlap`
 * columns fade from the columns past its end (which continue its last column) into their own. The
 * tile's last column then runs on into its first, so it repeats without a seam.
 */
function seamlessX(raster: Raster, overlap: number): Raster {
  const { width, height } = raster
  const tile = width - overlap
  const data = new Uint8Array(tile * height * CHANNELS)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < tile; x += 1) {
      const t = x < overlap ? x / overlap : 1
      for (let c = 0; c < CHANNELS; c += 1) {
        const own = raster.data[(y * width + x) * CHANNELS + c] ?? 0
        const past = x < overlap ? (raster.data[(y * width + tile + x) * CHANNELS + c] ?? 0) : own
        data[(y * tile + x) * CHANNELS + c] = Math.round(past * (1 - t) + own * t)
      }
    }
  }
  return { data, width: tile, height }
}

/** Seamless along both axes: `overlap` pixels are blended and trimmed on each. */
export function seamless(raster: Raster, overlap: number): Raster {
  if (overlap <= 0 || overlap >= Math.min(raster.width, raster.height)) {
    throw new Error(`the overlap ${String(overlap)} does not fit the image`)
  }
  return transpose(seamlessX(transpose(seamlessX(raster, overlap)), overlap))
}

/** The pixel at the `p`-th percentile of luma (0 darkest, 1 lightest). */
export function percentilePixel(raster: Raster, p: number): Rgb {
  const grey = lumas(raster)
  const order = Array.from(grey.keys()).sort((a, b) => (grey[a] ?? 0) - (grey[b] ?? 0))
  const index = order[Math.min(order.length - 1, Math.floor(p * order.length))] ?? 0
  const i = index * CHANNELS
  return [raster.data[i] ?? 0, raster.data[i + 1] ?? 0, raster.data[i + 2] ?? 0]
}
