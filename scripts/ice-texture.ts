// `make ice-texture`: the World's ice texture (#55) from the Owner's local crop of a Pexels photo
// (assets/ice/SOURCE.md). The crop is not in the repository (Pexels License: no redistribution as a
// stock image), only the result is: src/world/scene/ice.webp. Repeatable in the devcontainer:
//   1. crop the top rows, which hold the faint specks at the top right;
//   2. desaturate and pull towards the ice colour with lower contrast (scripts/ice/process.ts);
//   3. blend the edges so the tile repeats without a seam;
//   4. export WebP at a fixed quality and fail above the size limit.
// Runs under plain Node 24 (type stripping), so imports carry the .ts extension.
import { access, stat } from 'node:fs/promises'

import sharp from 'sharp'

import { seamless, toIce, type Rgb } from './ice/process.ts'

const SOURCE = 'assets/ice/Ice-surface-2-reduced.jpg'
const OUTPUT = 'src/world/scene/ice.webp'
/** The ice colour of src/world/scene/colours.ts, as 8-bit sRGB. */
const ICE: Rgb = [0xee, 0xf4, 0xf8]
/** Rows cropped from the top: the specks lie in the first 6 or so; 24 leaves a margin. */
const TOP_CROP = 24
/**
 * How much of the skate marks' contrast stays. The crop is already faint (luma standard deviation
 * 6.6 of 255): at the plan's 0.35 the marks fall to about ±2 levels and vanish, at 1 they keep the
 * photo's full contrast; 0.7 keeps them visible and quiet.
 */
const CONTRAST = 0.7
/** Pixels blended at the edges, on each axis. */
const OVERLAP = 64
/** Fixed: the quality is not tuned towards a size (Owner, A2 on #55). */
const WEBP = { quality: 80, effort: 6 }
/** The only size requirement: at most this many bytes (download until playable, plan §7). */
export const MAX_BYTES = 150_000

async function main(): Promise<void> {
  try {
    await access(SOURCE)
  } catch {
    throw new Error(
      `${SOURCE} is missing: it is not committed (Pexels License). Download the photo named in ` +
        `assets/ice/SOURCE.md, crop it as described there, save it as ${SOURCE} and run again.`,
    )
  }
  const image = sharp(SOURCE).removeAlpha().toColourspace('srgb')
  const { width, height } = await image.metadata()
  const { data, info } = await image
    .extract({ left: 0, top: TOP_CROP, width, height: height - TOP_CROP })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const raster = { data: new Uint8Array(data), width: info.width, height: info.height }
  const ice = seamless(toIce(raster, ICE, CONTRAST), OVERLAP)
  await sharp(Buffer.from(ice.data), {
    raw: { width: ice.width, height: ice.height, channels: 3 },
  })
    .webp(WEBP)
    .toFile(OUTPUT)
  const { size } = await stat(OUTPUT)
  console.log(`${OUTPUT}: ${String(ice.width)} x ${String(ice.height)} px, ${String(size)} B`)
  if (size > MAX_BYTES) {
    throw new Error(`${OUTPUT} is ${String(size)} B, above the ${String(MAX_BYTES)} B limit`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
