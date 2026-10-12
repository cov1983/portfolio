// The image encoder (plan §4, AC-27.1): sharp writes exactly what src/content/images.ts planned.
// I/O lives here and in content-plugin.ts only; the planner and loadContent stay pure.
import sharp, { type Sharp } from 'sharp'

import type { ImageFormat, ImageSize, VariantPlan } from '../src/content/images.ts'

/** One file for the bundle: `fileName` relative to the output directory. */
export type EmittedFile = { fileName: string; source: Buffer }

function encode(image: Sharp, format: ImageFormat): Sharp {
  switch (format) {
    case 'avif':
      return image.avif()
    case 'webp':
      return image.webp()
    case 'png':
      return image.png()
    case 'jpeg':
      return image.jpeg()
  }
}

/** Every planned variant of one source image, encoded in sequence (one image in memory at a time). */
export async function encodeVariants(
  sourcePath: string,
  plan: VariantPlan,
  targetDir: string,
): Promise<EmittedFile[]> {
  const image = sharp(sourcePath)
  const files: EmittedFile[] = []
  for (const variant of plan.variants) {
    const resized = image.clone().resize({ width: variant.width, withoutEnlargement: true })
    const source = await encode(resized, variant.format).toBuffer()
    files.push({ fileName: `${targetDir}/${variant.file}`, source })
  }
  return files
}

/** Pixel dimensions of a source image; rejects with sharp's reason when the file is not an image it reads. */
export async function imageDimensions(path: string): Promise<ImageSize> {
  const { width, height } = await sharp(path).metadata()
  return { width, height }
}
