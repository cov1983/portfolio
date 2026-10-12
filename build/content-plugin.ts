// The content plugin (plan §4, ADR 0011): the only place the content pipeline touches the disk.
// `buildStart` probes every image with sharp (Owner, #26 Q6), hands a ContentFs over the content
// directory to the pure loadContent, and fails the build with the ContentError's message, so
// `vite build` exits 1 naming file and field (AC-26.2, AC-26.3). The typed Content is served as
// `virtual:content`; the planned media files are emitted under dist/media/ at build (AC-27.1).
// Under `vite` (dev) the content is validated and served too, but media are written by the build
// only; under the dev server every planned media file is encoded or read on first request and
// kept in memory, so /media/exhibits/ and /media/site/ answer as the built site would (Owner,
// #26 Q12 and #27 Q12). The content directory is CONTENT_DIR relative to the Vite root, `content` by default; the build
// seam points it at a fixture (tests/build/content-build.test.ts). The SSR pass of build/build.ts
// validates and serves `virtual:content` like any build but encodes no media and prints no
// summary: the client pass did both. Outside the coverage ratchet (Vite glue, plan §6).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Logger, Plugin } from 'vite'

import { EXHIBIT_MEDIA_PREFIX, sourceFormat, type ImageSize } from '../src/content/images.ts'
import type { Content, ContentFs } from '../src/content/types.ts'
import {
  ContentError,
  SITE_MEDIA_PREFIX,
  loadContentWithMedia,
  mediaFiles,
  type MediaFile,
  type MediaJob,
} from '../src/content/validate.ts'
import { encodeVariant, encodeVariants, imageDimensions, type EmittedFile } from './images.ts'

export const DEFAULT_CONTENT_DIR = 'content'
const VIRTUAL_ID = 'virtual:content'
const RESOLVED_ID = '\0virtual:content'

type Sizes = Map<string, ImageSize>

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

function imageFiles(absoluteDir: string): string[] {
  if (!isDirectory(absoluteDir)) return []
  return readdirSync(absoluteDir)
    .filter((name) => sourceFormat(name) !== undefined && isFile(join(absoluteDir, name)))
    .sort()
}

/** Every PNG/JPEG under exhibits/<id>/ and at the content root (the preview), measured before validation. */
async function probeImages(root: string, dir: string): Promise<Sizes> {
  const candidates = imageFiles(join(root, dir)).map((name) => `${dir}/${name}`)
  const exhibits = join(root, dir, 'exhibits')
  if (isDirectory(exhibits)) {
    for (const entry of readdirSync(exhibits, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      for (const name of imageFiles(join(exhibits, entry.name))) {
        candidates.push(`${dir}/exhibits/${entry.name}/${name}`)
      }
    }
  }
  const sizes: Sizes = new Map()
  for (const file of candidates) {
    try {
      sizes.set(file, await imageDimensions(join(root, file)))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new ContentError(file, '', `unreadable image (${reason})`)
    }
  }
  return sizes
}

function diskFs(root: string, sizes: Sizes): ContentFs {
  return {
    readText: (path) =>
      isFile(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined,
    listDirectories: (path) =>
      isDirectory(join(root, path))
        ? readdirSync(join(root, path), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
        : [],
    exists: (path) => existsSync(join(root, path)),
    imageSize: (path) => sizes.get(path),
  }
}

type Loaded = { content: Content; media: MediaJob[] }

async function loadFromDisk(root: string, dir: string): Promise<Loaded> {
  return loadContentWithMedia(dir, diskFs(root, await probeImages(root, dir)))
}

/** The content directory read as the build reads it; for tests and tooling. Throws ContentError. */
export async function loadContentFromDisk(dir = DEFAULT_CONTENT_DIR): Promise<Content> {
  return (await loadFromDisk(process.cwd(), dir)).content
}

async function renderMedia(root: string, jobs: MediaJob[]): Promise<EmittedFile[]> {
  const files: EmittedFile[] = []
  for (const job of jobs) {
    if (job.kind === 'image') {
      files.push(...(await encodeVariants(join(root, job.source), job.plan, job.targetDir)))
    } else {
      files.push({ fileName: job.fileName, source: readFileSync(join(root, job.source)) })
    }
  }
  return files
}

const MEDIA_TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
}

type Served = { body: Buffer; type: string }

/** The bytes of one media file as the build would write them, with their content type. */
async function serveMedia(root: string, pathname: string, file: MediaFile): Promise<Served> {
  const extension = pathname.slice(pathname.lastIndexOf('.') + 1).toLowerCase()
  const type = MEDIA_TYPES[extension] ?? 'application/octet-stream'
  const body =
    file.kind === 'image'
      ? await encodeVariant(join(root, file.source), file.variant)
      : await readFile(join(root, file.source))
  return { body, type }
}

function isMediaPath(pathname: string): boolean {
  return pathname.startsWith(EXHIBIT_MEDIA_PREFIX) || pathname.startsWith(SITE_MEDIA_PREFIX)
}

/** How many files under dist/ one job produces. */
function fileCount(job: MediaJob): number {
  return job.kind === 'image' ? job.plan.variants.length : 1
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`
}

/** The ticket's demo line: what `make build` says about the content. */
function summaryOf({ content, media }: Loaded): string {
  const ids = content.exhibits.map((e) => e.id).join(', ')
  const images = media.filter((job) => job.kind === 'image').length
  const files = media.reduce((sum, job) => sum + fileCount(job), 0)
  return `content: ${plural(content.exhibits.length, 'Exhibit')} (${ids}) · ${plural(images, 'image')} → ${plural(files, 'media file')} · bio ok`
}

export function contentPlugin(): Plugin {
  let root = process.cwd()
  let isBuild = false
  let isSsr = false
  let logger: Logger | undefined
  let loaded: Loaded | undefined
  let files: EmittedFile[] = []
  /** Dev server: the planned files by URL and what was produced so far. */
  let index: Map<string, MediaFile> | undefined
  const served = new Map<string, Promise<Served>>()

  return {
    name: 'portfolio:content',

    configResolved(config) {
      root = config.root
      isBuild = config.command === 'build'
      isSsr = Boolean(config.build.ssr)
      logger = config.logger
    },

    async buildStart() {
      const dir = process.env['CONTENT_DIR'] ?? DEFAULT_CONTENT_DIR
      try {
        loaded = await loadFromDisk(root, dir)
        files = isBuild && !isSsr ? await renderMedia(root, loaded.media) : []
        index = undefined
        served.clear()
      } catch (error) {
        if (error instanceof ContentError) this.error(error.message)
        throw error
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url === undefined ? '' : new URL(req.url, 'http://localhost').pathname
        if (!isMediaPath(pathname) || loaded === undefined) {
          next()
          return
        }
        index ??= mediaFiles(loaded.media)
        const file = index.get(pathname)
        if (file === undefined) {
          res.statusCode = 404
          res.end()
          return
        }
        let pending = served.get(pathname)
        if (pending === undefined) {
          pending = serveMedia(root, pathname, file)
          served.set(pathname, pending)
        }
        pending.then(
          ({ body, type }) => {
            res.setHeader('Content-Type', type)
            res.end(body)
          },
          (error: unknown) => {
            next(error)
          },
        )
      })
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },

    load(id) {
      if (id !== RESOLVED_ID) return undefined
      if (loaded === undefined)
        this.error('virtual:content requested before the content was loaded')
      return `export const content = ${JSON.stringify(loaded.content)}\n`
    },

    generateBundle() {
      for (const file of files) {
        this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
      }
    },

    closeBundle() {
      if (loaded !== undefined && !isSsr) logger?.info(summaryOf(loaded))
    },
  }
}
