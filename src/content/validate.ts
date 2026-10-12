// loadContent (plan §4 "Validation at build", §5): the seven checks in order, first failure wins,
// a ContentError naming file and field; Markdown rendered with markdown-it at its default
// `html: false`, so raw HTML in a field becomes text (ADR 0011). Pure given the ContentFs facade:
// no Node import here; build/content-plugin.ts owns the disk and turns the error into a build error.
import MarkdownIt from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import type { z } from 'zod'

import {
  EXHIBIT_MEDIA_PREFIX,
  imageSet,
  planVariants,
  sourceFormat,
  type VariantPlan,
} from './images.ts'
import { encodeMailto } from './mailto.ts'
import {
  exhibitFrontMatterSchema,
  exhibitIdSchema,
  siteFileSchema,
  type ExhibitFrontMatter,
  type SiteFile,
} from './schema.ts'
import type { Content, ContentFs, Exhibit, ExhibitId, ImageSet } from './types.ts'

/** A content file the build rejects: `file` as the plugin prints it, `path` the field or '' for the whole file. */
export class ContentError extends Error {
  readonly file: string
  readonly path: string

  constructor(file: string, path: string, detail: string) {
    super(path === '' ? `${file}: ${detail}` : `${file}: ${path}: ${detail}`)
    this.name = 'ContentError'
    this.file = file
    this.path = path
  }
}

/** One file the build writes under dist/ for the content: image variants or a byte copy. */
export type MediaJob =
  | { kind: 'image'; source: string; plan: VariantPlan; targetDir: string }
  | { kind: 'copy'; source: string; fileName: string }

/** Where the site-level preview image goes; never under the Exhibit prefix (plan §4). */
export const SITE_MEDIA_PREFIX = '/media/site/'

const markdown = new MarkdownIt()

/** An Exhibit directory with its index.md, before the file is read. */
type ExhibitEntry = { id: ExhibitId; dir: string; file: string }
type Parsed = ExhibitEntry & { frontMatter: ExhibitFrontMatter }

/** The dist/ directory a URL prefix maps onto. */
function distDir(prefix: string): string {
  return prefix.slice(1)
}

// --- helpers ---------------------------------------------------------------------------------

function parseYamlOrThrow(file: string, text: string, label = ''): unknown {
  try {
    return parseYaml(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ContentError(file, '', `${label}does not parse (${reason.split('\n')[0] ?? ''})`)
  }
}

function issuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, key) =>
      typeof key === 'number'
        ? `${acc}[${String(key)}]`
        : acc === ''
          ? String(key)
          : `${acc}.${String(key)}`,
    '',
  )
}

/** The first zod issue as file and field (AC-26.2): a missing key is `required`, an unknown key names itself. */
function schemaError(file: string, issue: z.core.$ZodIssue): ContentError {
  if (issue.code === 'unrecognized_keys') {
    return new ContentError(file, issuePath([...issue.path, ...issue.keys]), 'unknown field')
  }
  const detail = issue.message.endsWith('received undefined') ? 'required' : issue.message
  return new ContentError(file, issuePath(issue.path), detail)
}

function parseWith<T>(schema: z.ZodType<T>, file: string, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const [issue] = result.error.issues
  if (issue === undefined) throw new ContentError(file, '', 'invalid')
  throw schemaError(file, issue)
}

/** Front matter between the `---` fences and the body after them. */
function splitFrontMatter(file: string, text: string): { yaml: string; body: string } {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') {
    throw new ContentError(file, '', 'no front matter (the file must start with ---)')
  }
  const end = lines.indexOf('---', 1)
  if (end === -1) {
    throw new ContentError(file, '', 'front matter not closed (a line with --- is missing)')
  }
  return { yaml: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n') }
}

function lastYear(year: string): number {
  return Number(year.slice(-4))
}

function isFileName(reference: string): boolean {
  return (
    !reference.includes('/') && !reference.includes('\\') && reference !== '.' && reference !== '..'
  )
}

/**
 * Check 4's shape for one reference: a bare file name inside `dir` (Owner, #26 Q4) that exists;
 * `found` answers existence (the probe's size for an image, the facade for anything else).
 */
function referencedFile<T>(
  file: string,
  path: string,
  reference: string,
  dir: string,
  where: string,
  found: (source: string) => T | undefined,
): { source: string; value: T } {
  if (!isFileName(reference)) {
    throw new ContentError(file, path, `${reference} must be a file in ${where}`)
  }
  const source = `${dir}/${reference}`
  const value = found(source)
  if (value === undefined) throw new ContentError(file, path, `${reference} not found`)
  return { source, value }
}

const IN_EXHIBIT = "the Exhibit's directory"

const INTERNAL_ROUTES = ['/', '/exhibits']
const LINK_RULE = 'must be an internal route (/, /exhibits, /exhibits#<id>) or an http(s) URL'

function isExternalUrl(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false
  try {
    return new URL(url).host !== ''
  } catch {
    return false
  }
}

// --- the checks ------------------------------------------------------------------------------

/** Check 1: site.yaml parses and matches the schema. */
function readSite(dir: string, fs: ContentFs): { file: string; site: SiteFile } {
  const file = `${dir}/site.yaml`
  const text = fs.readText(file)
  if (text === undefined) throw new ContentError(file, '', 'not found')
  return { file, site: parseWith(siteFileSchema, file, parseYamlOrThrow(file, text)) }
}

/** Check 2: every directory under exhibits/ has a valid id and an index.md. */
function listExhibits(dir: string, fs: ContentFs): ExhibitEntry[] {
  const root = `${dir}/exhibits`
  return fs.listDirectories(root).map((name) => {
    const id = exhibitIdSchema.safeParse(name)
    if (!id.success) {
      throw new ContentError(
        `${root}/${name}`,
        '',
        'not an Exhibit id (lower-case words joined by single hyphens)',
      )
    }
    const file = `${root}/${name}/index.md`
    if (!fs.exists(file)) throw new ContentError(file, '', 'not found')
    return { id: id.data, dir: `${root}/${name}`, file }
  })
}

/** Check 3: the front matter matches the schema and the body is empty. */
function parseExhibit(entry: ExhibitEntry, fs: ContentFs): Parsed {
  const text = fs.readText(entry.file)
  if (text === undefined) throw new ContentError(entry.file, '', 'not found')
  const { yaml, body } = splitFrontMatter(entry.file, text)
  const data = parseYamlOrThrow(entry.file, yaml, 'front matter ')
  const frontMatter = parseWith(exhibitFrontMatterSchema, entry.file, data)
  if (body.trim() !== '') {
    throw new ContentError(
      entry.file,
      'body',
      'must be empty (put prose in summary or whatIdDoDifferently)',
    )
  }
  return { ...entry, frontMatter }
}

/** Check 4, one image: a PNG or JPEG file in the Exhibit's directory that the probe measured. */
function imageOf(
  parsed: Parsed,
  path: string,
  reference: string,
  alt: string,
  fs: ContentFs,
): { set: ImageSet; job: MediaJob; name: string } {
  if (isFileName(reference) && sourceFormat(reference) === undefined) {
    throw new ContentError(parsed.file, path, `${reference} must be a PNG or JPEG`)
  }
  const { source, value: size } = referencedFile(
    parsed.file,
    path,
    reference,
    parsed.dir,
    IN_EXHIBIT,
    (s) => fs.imageSize(s),
  )
  const plan = planVariants(reference, size)
  const targetDir = `${distDir(EXHIBIT_MEDIA_PREFIX)}${parsed.id}`
  return {
    set: imageSet(parsed.id, plan, alt),
    job: { kind: 'image', source, plan, targetDir },
    name: plan.name,
  }
}

/** Check 4: every image, the video and its poster exist (AC-26.3). */
function resolveMedia(
  parsed: Parsed,
  fs: ContentFs,
): { images: ImageSet[]; video?: Exhibit['video']; jobs: MediaJob[] } {
  const jobs: MediaJob[] = []
  // Variants are named <base>-<w>.<ext>, so two images whose base names agree (photo.png and
  // photo.jpg, a poster named like an image) would overwrite each other in the built media.
  const bases = new Map<string, string>()
  const addImage = (path: string, reference: string, alt: string): ImageSet => {
    const { set, job, name } = imageOf(parsed, path, reference, alt, fs)
    const previous = bases.get(name)
    if (previous !== undefined) {
      throw new ContentError(
        parsed.file,
        path,
        `${reference} collides with ${previous} in the built media`,
      )
    }
    bases.set(name, reference)
    jobs.push(job)
    return set
  }
  const images = parsed.frontMatter.images.map((image, i) =>
    addImage(`images[${String(i)}].src`, image.src, image.alt),
  )
  const { video } = parsed.frontMatter
  if (video === undefined) return { images, jobs }
  if (isFileName(video.src) && !video.src.toLowerCase().endsWith('.mp4')) {
    throw new ContentError(parsed.file, 'video.src', `${video.src} must be an MP4`)
  }
  const { source } = referencedFile(
    parsed.file,
    'video.src',
    video.src,
    parsed.dir,
    IN_EXHIBIT,
    (s) => (fs.exists(s) ? true : undefined),
  )
  // A poster is the video's still (schema: no alt of its own); <video poster> takes the URL only.
  const poster = addImage('video.poster', video.poster, '')
  const fileName = `${distDir(EXHIBIT_MEDIA_PREFIX)}${parsed.id}/${video.src}`
  jobs.push({ kind: 'copy', source, fileName })
  return { images, video: { src: `/${fileName}`, type: 'video/mp4', poster }, jobs }
}

/** Check 5: an internal link points at a built route or a listed Exhibit; an external one is syntax-checked. */
function resolveLinks(parsed: Parsed, ids: Set<string>): Exhibit['links'] {
  return parsed.frontMatter.links.map((link, i) => {
    const path = `links[${String(i)}].url`
    if (link.url.startsWith('/')) {
      const [route, anchor] = link.url.split('#', 2) as [string, string?]
      const ok =
        anchor === undefined
          ? INTERNAL_ROUTES.includes(route)
          : route === '/exhibits' && ids.has(anchor)
      if (!ok) {
        throw new ContentError(
          parsed.file,
          path,
          `${link.url} is not a built route or a listed Exhibit`,
        )
      }
      return { label: link.label, url: link.url, external: false }
    }
    if (!isExternalUrl(link.url))
      throw new ContentError(parsed.file, path, `${link.url} ${LINK_RULE}`)
    return { label: link.label, url: link.url, external: true }
  })
}

/** Check 6: captions.zones has exactly the Exhibit ids; every caption ends with ., ! or ?. */
function checkCaptions(siteFile: string, site: SiteFile, ids: ExhibitId[]): void {
  const zones = site.captions.zones
  for (const id of ids) {
    if (!(id in zones)) {
      throw new ContentError(siteFile, `captions.zones.${id}`, 'required (one caption per Zone)')
    }
  }
  for (const key of Object.keys(zones)) {
    if (!ids.includes(key as ExhibitId)) {
      throw new ContentError(siteFile, `captions.zones.${key}`, 'no such Exhibit')
    }
  }
  const ending = /[.!?]$/
  if (!ending.test(site.captions.hub)) {
    throw new ContentError(siteFile, 'captions.hub', 'must end with ., ! or ?')
  }
  for (const [id, caption] of Object.entries(zones)) {
    if (!ending.test(caption)) {
      throw new ContentError(siteFile, `captions.zones.${id}`, 'must end with ., ! or ?')
    }
  }
}

/** Check 7: bio.md exists and is not empty. */
function readBio(dir: string, fs: ContentFs): string {
  const file = `${dir}/bio.md`
  const text = fs.readText(file)
  if (text === undefined) throw new ContentError(file, '', 'not found')
  if (text.trim() === '') throw new ContentError(file, '', 'empty')
  return markdown.render(text)
}

/** The preview image: site.yaml's file under /media/site/, else the first image of the first Exhibit. */
function resolvePreview(
  dir: string,
  siteFile: string,
  site: SiteFile,
  exhibits: Exhibit[],
  fs: ContentFs,
): { preview: Content['preview']; job?: MediaJob } {
  if (site.preview !== undefined) {
    const { source, value: size } = referencedFile(
      siteFile,
      'preview',
      site.preview,
      dir,
      'the content directory',
      (s) => fs.imageSize(s),
    )
    // Copied as is under one stable name, preview.<ext> (Owner, #26 Q10).
    const fileName = `${distDir(SITE_MEDIA_PREFIX)}preview.${site.preview.slice(site.preview.lastIndexOf('.') + 1)}`
    return { preview: { url: `/${fileName}`, ...size }, job: { kind: 'copy', source, fileName } }
  }
  const image = exhibits[0]?.images[0]
  if (image === undefined) {
    throw new ContentError(siteFile, 'preview', 'required when there is no Exhibit to fall back on')
  }
  return { preview: { url: image.fallback, width: image.width, height: image.height } }
}

// --- the loader ------------------------------------------------------------------------------

/** The typed Content plus the media files the build writes for it; throws ContentError. */
export function loadContentWithMedia(
  dir: string,
  fs: ContentFs,
): { content: Content; media: MediaJob[] } {
  const { file: siteFile, site } = readSite(dir, fs)
  const entries = listExhibits(dir, fs)
  const parsed = entries.map((entry) => parseExhibit(entry, fs))
  const media = parsed.map((p) => resolveMedia(p, fs))
  const ids = new Set<string>(parsed.map((p) => p.id))
  const links = parsed.map((p) => resolveLinks(p, ids))
  checkCaptions(
    siteFile,
    site,
    parsed.map((p) => p.id),
  )
  const bioHtml = readBio(dir, fs)

  const exhibits: Exhibit[] = parsed
    .map((p, i): Exhibit => {
      const { frontMatter } = p
      const resolved = media[i]
      const exhibit: Exhibit = {
        id: p.id,
        title: frontMatter.title,
        hook: frontMatter.hook,
        role: frontMatter.role,
        tech: frontMatter.tech,
        year: frontMatter.year,
        links: links[i] ?? [],
        images: resolved?.images ?? [],
        summaryHtml: markdown.render(frontMatter.summary),
        whatIdDoDifferentlyHtml: markdown.render(frontMatter.whatIdDoDifferently),
        visibility: frontMatter.visibility,
      }
      return resolved?.video === undefined ? exhibit : { ...exhibit, video: resolved.video }
    })
    .sort(
      (a, b) =>
        lastYear(b.year) - lastYear(a.year) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0),
    )

  const { preview, job: previewJob } = resolvePreview(dir, siteFile, site, exhibits, fs)
  const jobs = [...media.flatMap((m) => m.jobs), ...(previewJob === undefined ? [] : [previewJob])]

  return {
    content: {
      owner: { name: site.owner.name },
      oneLine: site.oneLine,
      contact: { github: site.contact.github, emailHrefEntities: encodeMailto(site.contact.email) },
      captions: { hub: site.captions.hub, zones: site.captions.zones },
      preview,
      bioHtml,
      exhibits,
    },
    media: jobs,
  }
}

/** The typed Content (plan §5), or a ContentError naming file and field. */
export function loadContent(dir: string, fs: ContentFs): Content {
  return loadContentWithMedia(dir, fs).content
}
