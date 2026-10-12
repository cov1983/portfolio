// Types shared by the content pipeline and everything that renders it (plan §5). The schema
// (schema.ts) is the only producer of an ExhibitId; `loadContent` (validate.ts) is the only
// producer of a Content. Type-only imports: nothing here reaches a browser chunk at runtime.
import type { z } from 'zod'

import type { exhibitIdSchema } from './schema'

/** The directory name of an Exhibit: its Fallback anchor, Zone id and caption key. Only the schema produces one. */
export type ExhibitId = z.infer<typeof exhibitIdSchema>

/** One source image as the built site serves it: variants under /media/exhibits/<id>/, never the original. */
export type ImageSet = {
  alt: string
  /** The largest variant. */
  width: number
  height: number
  /** /media/exhibits/<id>/<name>-<w>.<png|jpg>, never the original. */
  fallback: string
  sources: { type: 'image/avif' | 'image/webp'; srcset: string }[]
  sizes: string
}

export type Exhibit = {
  id: ExhibitId
  title: string
  hook: string
  role: string
  tech: string[]
  year: string
  links: { label: string; url: string; external: boolean }[]
  /** 1–3 */
  images: ImageSet[]
  video?: { src: string; type: 'video/mp4'; poster: ImageSet }
  summaryHtml: string
  whatIdDoDifferentlyHtml: string
  visibility: 'personal' | 'employer-generic'
}

export type Content = {
  owner: { name: string }
  oneLine: string
  /** `emailHrefEntities`: the href already character-reference encoded (AC-20.1). */
  contact: { github: string; emailHrefEntities: string }
  captions: { hub: string; zones: Record<ExhibitId, string> }
  preview: { url: string; width: number; height: number }
  bioHtml: string
  /** By the last year in `year`, descending, then `title`. */
  exhibits: Exhibit[]
}

/**
 * What `loadContent` reads, behind a facade so the loader stays pure and unit-tested in memory
 * (plan §4). Paths are posix strings under the content directory; the build's facade
 * (build/content-plugin.ts) maps them onto the disk and probes image dimensions with sharp
 * before validation (Owner, #26 Q6).
 */
export type ContentFs = {
  /** The file's text, or undefined when it does not exist. */
  readText(path: string): string | undefined
  /** The names of the subdirectories, sorted; [] when the directory does not exist. */
  listDirectories(path: string): string[]
  exists(path: string): boolean
  /** Pixel dimensions of an image file, or undefined when it does not exist. */
  imageSize(path: string): { width: number; height: number } | undefined
}
