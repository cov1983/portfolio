import { z } from 'zod'

// The content schema, the single source (plan §4; ADR 0011). No DOM, no React: this file runs under
// Node at build and in the unit tests. The field list is exactly AC-26.1's; the identifier is the
// directory name (exhibitIdSchema), never a field. `z.strictObject` instead of §4's `z.object`
// (Owner, #26 Q3): an unknown key is an error, so a misspelt optional key is never dropped silently.

/** The directory name of an Exhibit: its Fallback anchor, Zone id and caption key. */
export const exhibitIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .brand<'ExhibitId'>()

/** The front matter of `content/exhibits/<id>/index.md`. */
export const exhibitFrontMatterSchema = z.strictObject({
  title: z.string().min(1),
  hook: z.string().min(1), // one line
  summary: z.string().min(1), // Markdown, YAML block scalar
  role: z.string().min(1),
  tech: z.array(z.string().min(1)).min(1),
  // "2026", "2024–2026"; a hyphen is normalised to the en dash
  year: z
    .string()
    .regex(/^\d{4}([–-]\d{4})?$/)
    .transform((y) => y.replace('-', '–')),
  links: z.array(z.strictObject({ label: z.string().min(1), url: z.string().min(1) })),
  images: z
    .array(z.strictObject({ src: z.string().min(1), alt: z.string().min(1) }))
    .min(1)
    .max(3),
  video: z.strictObject({ src: z.string().min(1), poster: z.string().min(1) }).optional(),
  whatIdDoDifferently: z.string().min(1), // Markdown, YAML block scalar
  visibility: z.enum(['personal', 'employer-generic']),
})

/** `content/site.yaml`. */
export const siteFileSchema = z.strictObject({
  owner: z.strictObject({ name: z.string().min(1) }),
  oneLine: z.string().min(1), // the Title Screen's one line, written by the Owner
  contact: z.strictObject({ github: z.url(), email: z.email() }),
  captions: z.strictObject({
    hub: z.string().min(1),
    zones: z.record(exhibitIdSchema, z.string().min(1)),
  }),
  preview: z.string().min(1).optional(), // relative to content/
})

export type ExhibitFrontMatter = z.infer<typeof exhibitFrontMatterSchema>
export type SiteFile = z.infer<typeof siteFileSchema>
