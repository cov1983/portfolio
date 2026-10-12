// The image variant planner (plan §4, AC-27.1), pure: which files the build writes for one source
// image and the ImageSet the site renders from them. The encoder (build/images.ts) writes exactly
// this plan with sharp; the original file is never referenced and never copied.
import type { ExhibitId, ImageSet } from './types'

/** Target widths; each is capped at the source width, duplicates collapse. */
export const VARIANT_WIDTHS = [480, 960, 1440] as const

/** Where every Exhibit's media lives: the prefix the download budget excludes (plan §7). */
export const EXHIBIT_MEDIA_PREFIX = '/media/exhibits/'

/** The `sizes` attribute of every Exhibit picture (plan §5). */
export const IMAGE_SIZES = '(max-width: 800px) 100vw, 720px'

export type ImageFormat = 'avif' | 'webp' | 'png' | 'jpeg'
export type SourceFormat = Extract<ImageFormat, 'png' | 'jpeg'>

export type ImageSize = { width: number; height: number }

export type Variant = { file: string; format: ImageFormat; width: number; height: number }

export type VariantPlan = {
  /** The source's base name without its extension. */
  name: string
  /** Every file the build writes, the fallback included. */
  variants: Variant[]
  /** The source format at the largest width. */
  fallback: Variant
}

const EXTENSIONS: Record<ImageFormat, string> = {
  avif: 'avif',
  webp: 'webp',
  png: 'png',
  jpeg: 'jpg',
}

/** The format of a source file by its extension; undefined for anything but PNG and JPEG. */
export function sourceFormat(file: string): SourceFormat | undefined {
  const extension = file.toLowerCase().split('.').pop()
  if (extension === 'png') return 'png'
  if (extension === 'jpg' || extension === 'jpeg') return 'jpeg'
  return undefined
}

function variant(name: string, format: ImageFormat, width: number, source: ImageSize): Variant {
  const height = Math.max(1, Math.round((source.height * width) / source.width))
  return { file: `${name}-${String(width)}.${EXTENSIONS[format]}`, format, width, height }
}

/** The files to write for one source image: AVIF and WebP per width, plus the fallback. */
export function planVariants(file: string, source: ImageSize): VariantPlan {
  const format = sourceFormat(file)
  if (format === undefined) throw new Error(`${file}: not a PNG or JPEG source`)
  const name = file.slice(0, file.lastIndexOf('.'))
  const widths = [...new Set(VARIANT_WIDTHS.map((w) => Math.min(w, source.width)))]
  const variants = widths.flatMap((width) => [
    variant(name, 'avif', width, source),
    variant(name, 'webp', width, source),
  ])
  const fallback = variant(name, format, widths[widths.length - 1] ?? source.width, source)
  return { name, variants: [...variants, fallback], fallback }
}

function srcset(exhibitId: ExhibitId, variants: Variant[], format: ImageFormat): string {
  return variants
    .filter((v) => v.format === format)
    .map((v) => `${EXHIBIT_MEDIA_PREFIX}${exhibitId}/${v.file} ${String(v.width)}w`)
    .join(', ')
}

/** The ImageSet the site renders for a planned source image. */
export function imageSet(exhibitId: ExhibitId, plan: VariantPlan, alt: string): ImageSet {
  return {
    alt,
    width: plan.fallback.width,
    height: plan.fallback.height,
    fallback: `${EXHIBIT_MEDIA_PREFIX}${exhibitId}/${plan.fallback.file}`,
    sources: [
      { type: 'image/avif', srcset: srcset(exhibitId, plan.variants, 'avif') },
      { type: 'image/webp', srcset: srcset(exhibitId, plan.variants, 'webp') },
    ],
    sizes: IMAGE_SIZES,
  }
}
