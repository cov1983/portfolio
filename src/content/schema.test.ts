import { describe, expect, it } from 'vitest'

import { exhibitFrontMatterSchema, exhibitIdSchema, siteFileSchema } from './schema'

// Plan §4: the id regex (the directory name), the year pattern with its en-dash normalisation, the
// 1–3 images, the two visibility values, the site file's formats. The validator (validate.test.ts)
// proves file and field in the error; here the schemas alone.
const FRONT_MATTER = {
  title: 'A title',
  hook: 'One line.',
  summary: 'Some *Markdown*.',
  role: 'Owner',
  tech: ['TypeScript'],
  year: '2026',
  links: [{ label: 'Repository', url: 'https://example.com/repo' }],
  images: [{ src: 'photo.png', alt: 'A photo.' }],
  whatIdDoDifferently: 'Nothing yet.',
  visibility: 'personal',
}

const SITE = {
  owner: { name: 'Thomas' },
  oneLine: 'One line.',
  contact: { github: 'https://github.com/cov1983', email: 'hello@example.com' },
  captions: { hub: 'Welcome.', zones: { portfolio: 'Found it.' } },
}

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? []
}

describe('exhibitIdSchema', () => {
  it('accepts lower-case words joined by single hyphens', () => {
    for (const id of ['a', 'a-b1', 'portfolio', 'exhibit-1']) {
      expect(exhibitIdSchema.safeParse(id).success, id).toBe(true)
    }
  })

  it('rejects a leading hyphen, a double hyphen, an upper-case letter and the empty string', () => {
    for (const id of ['-a', 'a--b', 'Portfolio', '', 'a-']) {
      expect(exhibitIdSchema.safeParse(id).success, id).toBe(false)
    }
  })
})

describe('exhibitFrontMatterSchema', () => {
  it('accepts the full field list of AC-26.1', () => {
    expect(exhibitFrontMatterSchema.safeParse(FRONT_MATTER).success).toBe(true)
  })

  it('year accepts a single year and a range', () => {
    for (const year of ['2026', '2024–2026']) {
      const result = exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, year })
      expect(result.success, year).toBe(true)
    }
  })

  it('year normalises a hyphen to the en dash', () => {
    const result = exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, year: '2024-2026' })
    expect(result.success && result.data.year).toBe('2024–2026')
  })

  it('year rejects anything else', () => {
    for (const year of ['26', '2024-26', '2024 – 2026', '2026-', 'now']) {
      const result = exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, year })
      expect(issuePaths(result), year).toEqual(['year'])
    }
  })

  it('images allows one to three entries', () => {
    const image = { src: 'photo.png', alt: 'A photo.' }
    expect(issuePaths(exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, images: [] }))).toEqual(
      ['images'],
    )
    expect(
      exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, images: [image, image, image] })
        .success,
    ).toBe(true)
    expect(
      issuePaths(
        exhibitFrontMatterSchema.safeParse({
          ...FRONT_MATTER,
          images: [image, image, image, image],
        }),
      ),
    ).toEqual(['images'])
  })

  it('visibility rejects an unknown value with the field in the issue path', () => {
    const result = exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, visibility: 'public' })
    expect(issuePaths(result)).toEqual(['visibility'])
  })

  it('video needs a poster', () => {
    const result = exhibitFrontMatterSchema.safeParse({
      ...FRONT_MATTER,
      video: { src: 'clip.mp4' },
    })
    expect(issuePaths(result)).toEqual(['video.poster'])
  })

  it('rejects an unknown key instead of dropping it (Owner, #26 Q3)', () => {
    const result = exhibitFrontMatterSchema.safeParse({ ...FRONT_MATTER, vidoe: {} })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Unrecognized key: "vidoe"',
    ])
  })
})

describe('siteFileSchema', () => {
  it('accepts the site file with and without a preview image', () => {
    expect(siteFileSchema.safeParse(SITE).success).toBe(true)
    expect(siteFileSchema.safeParse({ ...SITE, preview: 'preview.png' }).success).toBe(true)
  })

  it('rejects a contact e-mail that is not an e-mail address', () => {
    const result = siteFileSchema.safeParse({ ...SITE, contact: { ...SITE.contact, email: 'x' } })
    expect(issuePaths(result)).toEqual(['contact.email'])
  })

  it('rejects a GitHub value that is not a URL', () => {
    const result = siteFileSchema.safeParse({ ...SITE, contact: { ...SITE.contact, github: 'x' } })
    expect(issuePaths(result)).toEqual(['contact.github'])
  })

  it('keys captions.zones by Exhibit id', () => {
    const result = siteFileSchema.safeParse({
      ...SITE,
      captions: { hub: 'Welcome.', zones: { 'Not-An-Id': 'Found it.' } },
    })
    expect(issuePaths(result)).toEqual(['captions.zones.Not-An-Id'])
  })

  it('rejects an unknown key instead of dropping it (Owner, #26 Q3)', () => {
    const result = siteFileSchema.safeParse({ ...SITE, previews: 'preview.png' })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Unrecognized key: "previews"',
    ])
  })
})
