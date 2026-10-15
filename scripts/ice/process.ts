// The ice texture's pixel steps (#55), pure, on raw interleaved 8-bit sRGB (3 channels): the values
// the WebP file holds and the scene samples with SRGBColorSpace. scripts/ice-texture.ts does the I/O.

/** The texture's only size requirement: at most this many bytes (Owner, A2 on #55). */
export const MAX_BYTES = 150_000

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
 * A box blur of `radius` along one line of `n` values (`at(i)` reads the i-th), written by `put`.
 * Past each end the line is point-reflected through the mean of its first (last) 2·radius + 1
 * values, placed at their centre: a linear trend stays linear, so a gradient blurs to itself up to
 * the edges and is flattened there too, and pivoting on a mean rather than on the end pixel keeps
 * the fine detail at the edge from shifting the whole extension.
 */
function boxLine(
  n: number,
  radius: number,
  at: (i: number) => number,
  put: (i: number, value: number) => void,
): void {
  const span = 2 * radius + 1
  let head = 0
  let tail = 0
  for (let i = 0; i < span; i += 1) {
    head += at(i)
    tail += at(n - 1 - i)
  }
  head /= span
  tail /= span
  const value = (i: number): number =>
    i < 0 ? 2 * head - at(2 * radius - i) : i >= n ? 2 * tail - at(2 * (n - 1 - radius) - i) : at(i)
  let sum = 0
  for (let i = -radius; i <= radius; i += 1) sum += value(i)
  for (let i = 0; i < n; i += 1) {
    put(i, sum / span)
    sum += value(i + radius + 1) - value(i - radius)
  }
}

/** Three box-blur passes along x and y: close to a Gaussian of σ ≈ radius (per pass √(r(r+1)/3)). */
function blur(values: Float64Array, width: number, height: number, radius: number): Float64Array {
  let current = values
  for (let pass = 0; pass < 3; pass += 1) {
    const rows = new Float64Array(current.length)
    for (let y = 0; y < height; y += 1) {
      const source = current
      boxLine(
        width,
        radius,
        (x) => source[y * width + x] ?? 0,
        (x, v) => (rows[y * width + x] = v),
      )
    }
    const columns = new Float64Array(current.length)
    for (let x = 0; x < width; x += 1) {
      boxLine(
        height,
        radius,
        (y) => rows[y * width + x] ?? 0,
        (y, v) => (columns[y * width + x] = v),
      )
    }
    current = columns
  }
  return current
}

/**
 * Low-frequency brightness removed: the luma blurred over `radius` is the photo's soft light (a
 * gradient, broad shading), and each pixel loses that blur's departure from its mean in every
 * channel. Fine detail, the skate marks a few pixels wide, is narrower than the blur and stays.
 * Without this step the tile's soft bands show as a repeat pattern on the ice (Owner on #56).
 */
export function flatten(raster: Raster, radius: number): Raster {
  if (radius < 1 || 4 * radius + 2 > Math.min(raster.width, raster.height)) {
    throw new Error(`the blur radius ${String(radius)} does not fit the image`)
  }
  const soft = blur(lumas(raster), raster.width, raster.height, radius)
  const centre = mean(soft)
  const data = new Uint8Array(raster.data.length)
  soft.forEach((s, p) => {
    for (let c = 0; c < CHANNELS; c += 1) {
      const value = (raster.data[p * CHANNELS + c] ?? 0) - (s - centre)
      data[p * CHANNELS + c] = Math.min(255, Math.max(0, Math.round(value)))
    }
  })
  return { data, width: raster.width, height: raster.height }
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
