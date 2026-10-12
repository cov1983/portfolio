import { describe, expect, it } from 'vitest'

import type { ImageSize } from './images'
import type { ContentFs } from './types'
import { ContentError, loadContent, loadContentWithMedia } from './validate'

// Plan §4 "Validation at build": the seven checks in order, first failure wins, through an
// in-memory facade (no Node types in src/). A text value is a file's content; an ImageSize is an
// image the build's probe would have measured (Owner, #26 Q6). The real content/ is proven on the
// build seam (tests/build/content-build.test.ts).
type Tree = Record<string, string | ImageSize>

const DIR = 'content'

function memoryFs(tree: Tree): ContentFs {
  const paths = Object.keys(tree)
  return {
    readText(path) {
      const entry = tree[path]
      return typeof entry === 'string' ? entry : undefined
    },
    listDirectories(path) {
      const names = paths
        .filter((p) => p.startsWith(`${path}/`))
        .map((p) => p.slice(path.length + 1))
        .filter((rest) => rest.includes('/'))
        .map((rest) => rest.slice(0, rest.indexOf('/')))
      return [...new Set(names)].sort()
    },
    exists(path) {
      return path in tree
    },
    imageSize(path) {
      const entry = tree[path]
      return typeof entry === 'object' ? entry : undefined
    },
  }
}

const SITE = `owner:
  name: Thomas
oneLine: One line.
contact:
  github: https://github.com/cov1983
  email: hello@example.com
captions:
  hub: Welcome!
  zones:
    portfolio: Found it.
`

function exhibitFile(overrides: Record<string, string> = {}, body = ''): string {
  const fields: Record<string, string> = {
    title: 'title: This portfolio',
    hook: 'hook: A puck and a paper trail.',
    summary: 'summary: |\n  Steer the *puck*.\n',
    role: 'role: Owner',
    tech: 'tech:\n  - TypeScript',
    year: 'year: "2026"',
    links:
      'links:\n  - label: Repository\n    url: https://github.com/cov1983/portfolio\n  - label: Fallback\n    url: /exhibits#portfolio',
    images: 'images:\n  - src: photo.png\n    alt: A flowchart.',
    whatIdDoDifferently: 'whatIdDoDifferently: |\n  Not yet.\n',
    visibility: 'visibility: personal',
    ...overrides,
  }
  const lines = Object.values(fields).filter((line) => line !== '')
  return `---\n${lines.join('\n')}\n---\n${body}`
}

const VALID: Tree = {
  [`${DIR}/site.yaml`]: SITE,
  [`${DIR}/bio.md`]: "I'm Thomas. *Hello.*\n",
  [`${DIR}/exhibits/portfolio/index.md`]: exhibitFile(),
  [`${DIR}/exhibits/portfolio/photo.png`]: { width: 1800, height: 1580 },
}

function without(tree: Tree, path: string): Tree {
  const copy = { ...tree }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing one file from a literal tree
  delete copy[path]
  return copy
}

function load(tree: Tree) {
  return loadContent(DIR, memoryFs(tree))
}

function failure(tree: Tree): ContentError {
  try {
    load(tree)
  } catch (error) {
    if (error instanceof ContentError) return error
    throw error
  }
  throw new Error('loadContent did not throw')
}

function expectFailure(tree: Tree, message: string): void {
  expect(failure(tree).message).toBe(message)
}

/** For a message whose detail is zod's own wording: file and field are ours, the rest may move with a zod patch. */
function expectFailureAt(tree: Tree, fileAndField: string): void {
  expect(failure(tree).message).toMatch(new RegExp(`^${fileAndField.replace(/[.[\]]/g, '\\$&')}: `))
}

const INDEX = `${DIR}/exhibits/portfolio/index.md`
const SITE_FILE = `${DIR}/site.yaml`

describe('loadContent on a valid tree', () => {
  const content = load(VALID)

  it('returns the typed Content: id from the directory, links flagged, captions by id', () => {
    expect(content.exhibits.map((e) => e.id)).toEqual(['portfolio'])
    const [exhibit] = content.exhibits
    expect(exhibit?.links).toEqual([
      { label: 'Repository', url: 'https://github.com/cov1983/portfolio', external: true },
      { label: 'Fallback', url: '/exhibits#portfolio', external: false },
    ])
    expect(content.captions).toEqual({ hub: 'Welcome!', zones: { portfolio: 'Found it.' } })
    expect(content.owner).toEqual({ name: 'Thomas' })
    expect(content.oneLine).toBe('One line.')
  })

  it('carries the plain fields of AC-26.1 and the year as written', () => {
    const [exhibit] = content.exhibits
    expect([exhibit?.title, exhibit?.hook, exhibit?.role, exhibit?.tech, exhibit?.year]).toEqual([
      'This portfolio',
      'A puck and a paper trail.',
      'Owner',
      ['TypeScript'],
      '2026',
    ])
    expect(exhibit?.visibility).toBe('personal')
  })

  it('renders summary and whatIdDoDifferently to HTML with raw HTML escaped', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        summary: 'summary: |\n  Hi <script>alert(1)</script> *there*\n',
        whatIdDoDifferently: 'whatIdDoDifferently: |\n  Less <b>bold</b>.\n',
      }),
    }
    const [exhibit] = load(tree).exhibits
    expect(exhibit?.summaryHtml).toBe(
      '<p>Hi &lt;script&gt;alert(1)&lt;/script&gt; <em>there</em></p>\n',
    )
    expect(exhibit?.whatIdDoDifferentlyHtml).toBe('<p>Less &lt;b&gt;bold&lt;/b&gt;.</p>\n')
  })

  it('renders bio.md to HTML', () => {
    expect(content.bioHtml).toBe("<p>I'm Thomas. <em>Hello.</em></p>\n")
  })

  it('encodes the Contact e-mail href as character references and keeps the GitHub URL', () => {
    expect(content.contact.github).toBe('https://github.com/cov1983')
    expect(content.contact.emailHrefEntities).toMatch(/^(&#\d+;)+$/)
    expect(content.contact.emailHrefEntities).not.toContain('mailto:')
  })

  it('builds the ImageSet of each image from its measured size', () => {
    const [image] = content.exhibits[0]?.images ?? []
    expect(image?.fallback).toBe('/media/exhibits/portfolio/photo-1440.png')
    expect([image?.width, image?.height, image?.alt]).toEqual([1440, 1264, 'A flowchart.'])
    expect(image?.sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp'])
  })

  it('normalises a hyphen in year to the en dash', () => {
    const tree = { ...VALID, [INDEX]: exhibitFile({ year: 'year: 2024-2026' }) }
    expect(load(tree).exhibits[0]?.year).toBe('2024–2026')
  })

  it('orders Exhibits by the last year descending, then title', () => {
    const tree: Tree = {
      ...VALID,
      [`${DIR}/site.yaml`]: `${SITE}    alpha: One.\n    beta: Two.\n    gamma: Three.\n`,
      [`${DIR}/exhibits/alpha/index.md`]: exhibitFile({
        title: 'title: Zeta',
        year: 'year: 2020-2027',
      }),
      [`${DIR}/exhibits/alpha/photo.png`]: { width: 100, height: 50 },
      [`${DIR}/exhibits/beta/index.md`]: exhibitFile({
        title: 'title: Beta',
        year: 'year: "2027"',
      }),
      [`${DIR}/exhibits/beta/photo.png`]: { width: 100, height: 50 },
      [`${DIR}/exhibits/gamma/index.md`]: exhibitFile({
        title: 'title: Gamma',
        year: 'year: "2019"',
      }),
      [`${DIR}/exhibits/gamma/photo.png`]: { width: 100, height: 50 },
    }
    expect(load(tree).exhibits.map((e) => e.id)).toEqual(['beta', 'alpha', 'portfolio', 'gamma'])
  })

  it('attaches a video with its poster through the image pipeline', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A flowchart.\nvideo:\n  src: clip.mp4\n  poster: still.jpg',
      }),
      [`${DIR}/exhibits/portfolio/clip.mp4`]: 'bytes',
      [`${DIR}/exhibits/portfolio/still.jpg`]: { width: 640, height: 360 },
    }
    expect(load(tree).exhibits[0]?.video).toEqual({
      src: '/media/exhibits/portfolio/clip.mp4',
      type: 'video/mp4',
      poster: expect.objectContaining({
        fallback: '/media/exhibits/portfolio/still-640.jpg',
      }) as unknown,
    })
  })

  it('uses preview.png when present, under /media/site/', () => {
    const tree: Tree = {
      ...VALID,
      [SITE_FILE]: `${SITE}preview: preview.png\n`,
      [`${DIR}/preview.png`]: { width: 1200, height: 630 },
    }
    expect(load(tree).preview).toEqual({ url: '/media/site/preview.png', width: 1200, height: 630 })
  })

  it('copies a preview of another name as preview.<ext> (Owner, #26 Q10)', () => {
    const tree: Tree = {
      ...VALID,
      [SITE_FILE]: `${SITE}preview: social.jpg\n`,
      [`${DIR}/preview.png`]: { width: 1200, height: 630 },
      [`${DIR}/social.jpg`]: { width: 1200, height: 600 },
    }
    expect(load(tree).preview.url).toBe('/media/site/preview.jpg')
  })

  it('falls back to the first image of the first Exhibit for the preview', () => {
    expect(content.preview).toEqual({
      url: '/media/exhibits/portfolio/photo-1440.png',
      width: 1440,
      height: 1264,
    })
  })

  it('lists the media the build writes: variants per image, the video and the preview copied', () => {
    const tree: Tree = {
      ...VALID,
      [SITE_FILE]: `${SITE}preview: preview.png\n`,
      [`${DIR}/preview.png`]: { width: 1200, height: 630 },
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A flowchart.\nvideo:\n  src: clip.mp4\n  poster: still.jpg',
      }),
      [`${DIR}/exhibits/portfolio/clip.mp4`]: 'bytes',
      [`${DIR}/exhibits/portfolio/still.jpg`]: { width: 640, height: 360 },
    }
    const { media } = loadContentWithMedia(DIR, memoryFs(tree))
    expect(
      media.map((job) =>
        job.kind === 'image'
          ? `${job.kind} ${job.source} → ${job.targetDir}/${job.plan.name}`
          : `${job.kind} ${job.source} → ${job.fileName}`,
      ),
    ).toEqual([
      'image content/exhibits/portfolio/photo.png → media/exhibits/portfolio/photo',
      'image content/exhibits/portfolio/still.jpg → media/exhibits/portfolio/still',
      'copy content/exhibits/portfolio/clip.mp4 → media/exhibits/portfolio/clip.mp4',
      'copy content/preview.png → media/site/preview.png',
    ])
  })
})

describe('check 1: site.yaml', () => {
  it('fails when site.yaml is missing, naming the file', () => {
    expectFailure(without(VALID, SITE_FILE), `${SITE_FILE}: not found`)
  })

  it('fails on a site.yaml that does not parse, naming the file', () => {
    expect(failure({ ...VALID, [SITE_FILE]: 'owner: [unclosed' }).message).toMatch(
      new RegExp(`^${SITE_FILE}: does not parse \\(`),
    )
  })

  it('names the path of a site.yaml field (contact.email)', () => {
    const tree = { ...VALID, [SITE_FILE]: SITE.replace('hello@example.com', 'nobody') }
    expectFailureAt(tree, `${SITE_FILE}: contact.email`)
  })

  it('reports a missing site.yaml field as required', () => {
    const tree = { ...VALID, [SITE_FILE]: SITE.replace('oneLine: One line.\n', '') }
    expectFailure(tree, `${SITE_FILE}: oneLine: required`)
  })
})

describe('check 2: the exhibits directories', () => {
  it('fails on an exhibits directory whose name is not an id', () => {
    const tree: Tree = {
      ...VALID,
      [`${DIR}/exhibits/My-Project/index.md`]: exhibitFile(),
    }
    expectFailure(
      tree,
      `${DIR}/exhibits/My-Project: not an Exhibit id (lower-case words joined by single hyphens)`,
    )
  })

  it('fails on an exhibits directory without index.md (a stray directory is never hidden)', () => {
    const tree: Tree = { ...VALID, [`${DIR}/exhibits/stray/notes.txt`]: 'x' }
    expectFailure(tree, `${DIR}/exhibits/stray/index.md: not found`)
  })
})

describe('check 3: each Exhibit file', () => {
  it('reports images[0].alt: required for a missing field', () => {
    const tree = { ...VALID, [INDEX]: exhibitFile({ images: 'images:\n  - src: photo.png' }) }
    expectFailure(tree, `${INDEX}: images[0].alt: required`)
  })

  it('names the visibility field for an unknown value', () => {
    const tree = { ...VALID, [INDEX]: exhibitFile({ visibility: 'visibility: public' }) }
    expectFailureAt(tree, `${INDEX}: visibility`)
  })

  it('names an unknown field instead of dropping it', () => {
    const tree = { ...VALID, [INDEX]: exhibitFile({ extra: 'vidoe: {}' }) }
    expectFailure(tree, `${INDEX}: vidoe: unknown field`)
  })

  it('fails on a file without front matter', () => {
    const tree = { ...VALID, [INDEX]: '# Not front matter\n' }
    expectFailure(tree, `${INDEX}: no front matter (the file must start with ---)`)
  })

  it('fails on front matter that is not closed', () => {
    const tree = { ...VALID, [INDEX]: '---\ntitle: x\n' }
    expectFailure(tree, `${INDEX}: front matter not closed (a line with --- is missing)`)
  })

  it('fails on front matter that does not parse', () => {
    const tree = { ...VALID, [INDEX]: '---\ntitle: [unclosed\n---\n' }
    expect(failure(tree).message).toMatch(new RegExp(`^${INDEX}: front matter does not parse \\(`))
  })

  it('fails on a non-empty body with the summary hint', () => {
    const tree = { ...VALID, [INDEX]: exhibitFile({}, '\nSome prose below the fence.\n') }
    expectFailure(
      tree,
      `${INDEX}: body: must be empty (put prose in summary or whatIdDoDifferently)`,
    )
  })
})

describe('check 4: references on disk', () => {
  it('names file and reference for a missing image', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({ images: 'images:\n  - src: absent.png\n    alt: A.' }),
    }
    expectFailure(tree, `${INDEX}: images[0].src: absent.png not found`)
  })

  it('rejects an image that is not a PNG or JPEG', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({ images: 'images:\n  - src: photo.gif\n    alt: A.' }),
      [`${DIR}/exhibits/portfolio/photo.gif`]: { width: 10, height: 10 },
    }
    expectFailure(tree, `${INDEX}: images[0].src: photo.gif must be a PNG or JPEG`)
  })

  it('rejects a reference that is not a file name in the Exhibit directory (Owner, #26 Q4)', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({ images: 'images:\n  - src: ../photo.png\n    alt: A.' }),
    }
    expectFailure(
      tree,
      `${INDEX}: images[0].src: ../photo.png must be a file in the Exhibit's directory`,
    )
  })

  it('rejects two references whose base names collide in the built media', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images: 'images:\n  - src: photo.png\n    alt: A.\n  - src: photo.jpg\n    alt: B.',
      }),
      [`${DIR}/exhibits/portfolio/photo.jpg`]: { width: 100, height: 50 },
    }
    expectFailure(
      tree,
      `${INDEX}: images[1].src: photo.jpg collides with photo.png in the built media`,
    )
  })

  it('names file and reference for a missing video source', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A.\nvideo:\n  src: clip.mp4\n  poster: photo.png',
      }),
    }
    expectFailure(tree, `${INDEX}: video.src: clip.mp4 not found`)
  })

  it('rejects a video reference that is not a file name in the Exhibit directory', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A.\nvideo:\n  src: ../clip.mp4\n  poster: photo.png',
      }),
    }
    expectFailure(
      tree,
      `${INDEX}: video.src: ../clip.mp4 must be a file in the Exhibit's directory`,
    )
  })

  it('rejects a video that is not an MP4', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A.\nvideo:\n  src: clip.mov\n  poster: photo.png',
      }),
      [`${DIR}/exhibits/portfolio/clip.mov`]: 'bytes',
    }
    expectFailure(tree, `${INDEX}: video.src: clip.mov must be an MP4`)
  })

  it('names file and reference for a missing poster', () => {
    const tree: Tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images:
          'images:\n  - src: photo.png\n    alt: A.\nvideo:\n  src: clip.mp4\n  poster: absent.png',
      }),
      [`${DIR}/exhibits/portfolio/clip.mp4`]: 'bytes',
    }
    expectFailure(tree, `${INDEX}: video.poster: absent.png not found`)
  })
})

describe('check 5: links', () => {
  it('accepts /, /exhibits and /exhibits#<id> as internal links', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        links:
          'links:\n  - label: Home\n    url: /\n  - label: All\n    url: /exhibits\n  - label: Me\n    url: /exhibits#portfolio',
      }),
    }
    expect(load(tree).exhibits[0]?.links.map((l) => l.external)).toEqual([false, false, false])
  })

  it('fails on an internal link to an unknown Exhibit', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({ links: 'links:\n  - label: Other\n    url: /exhibits#nope' }),
    }
    expectFailure(
      tree,
      `${INDEX}: links[0].url: /exhibits#nope is not a built route or a listed Exhibit`,
    )
  })

  it('fails on a link that is neither internal nor http(s)', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({ links: 'links:\n  - label: Mail\n    url: mailto:x@y.z' }),
    }
    expectFailure(
      tree,
      `${INDEX}: links[0].url: mailto:x@y.z must be an internal route (/, /exhibits, /exhibits#<id>) or an http(s) URL`,
    )
  })

  it('fails on an http(s) link that does not parse as a URL', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({ links: 'links:\n  - label: Bad\n    url: "https://"' }),
    }
    expectFailure(
      tree,
      `${INDEX}: links[0].url: https:// must be an internal route (/, /exhibits, /exhibits#<id>) or an http(s) URL`,
    )
  })
})

describe('check 6: captions', () => {
  it('fails when captions.zones misses an Exhibit', () => {
    const tree = { ...VALID, [SITE_FILE]: SITE.replace('    portfolio: Found it.\n', '    {}\n') }
    expectFailure(tree, `${SITE_FILE}: captions.zones.portfolio: required (one caption per Zone)`)
  })

  it('fails when captions.zones names an unknown Exhibit', () => {
    const tree = { ...VALID, [SITE_FILE]: `${SITE}    other: Nope.\n` }
    expectFailure(tree, `${SITE_FILE}: captions.zones.other: no such Exhibit`)
  })

  it('fails on a hub caption without ., ! or ?', () => {
    const tree = { ...VALID, [SITE_FILE]: SITE.replace('Welcome!', 'Welcome') }
    expectFailure(tree, `${SITE_FILE}: captions.hub: must end with ., ! or ?`)
  })

  it('fails on a zone caption without ., ! or ?', () => {
    const tree = { ...VALID, [SITE_FILE]: SITE.replace('Found it.', 'Found it') }
    expectFailure(tree, `${SITE_FILE}: captions.zones.portfolio: must end with ., ! or ?`)
  })
})

describe('check 7: bio.md', () => {
  it('fails when bio.md is missing', () => {
    expectFailure(without(VALID, `${DIR}/bio.md`), `${DIR}/bio.md: not found`)
  })

  it('fails when bio.md is empty', () => {
    expectFailure({ ...VALID, [`${DIR}/bio.md`]: '  \n' }, `${DIR}/bio.md: empty`)
  })
})

describe('the preview image', () => {
  it('rejects a preview that is not a file name in the content directory', () => {
    const tree = { ...VALID, [SITE_FILE]: `${SITE}preview: ../preview.png\n` }
    expectFailure(
      tree,
      `${SITE_FILE}: preview: ../preview.png must be a file in the content directory`,
    )
  })

  it('fails without a preview when there is no Exhibit to fall back on', () => {
    const tree: Tree = {
      [SITE_FILE]: SITE.replace('    portfolio: Found it.\n', '    {}\n'),
      [`${DIR}/bio.md`]: 'Hi.',
    }
    expectFailure(tree, `${SITE_FILE}: preview: required when there is no Exhibit to fall back on`)
  })

  it('fails when site.yaml names a preview that does not exist', () => {
    const tree = { ...VALID, [SITE_FILE]: `${SITE}preview: preview.png\n` }
    expectFailure(tree, `${SITE_FILE}: preview: preview.png not found`)
  })
})

describe('order: first failure wins', () => {
  it('reports the site.yaml error before an Exhibit error', () => {
    const tree = {
      ...VALID,
      [SITE_FILE]: SITE.replace('hello@example.com', 'nobody'),
      [INDEX]: exhibitFile({ images: 'images:\n  - src: photo.png' }),
    }
    expectFailureAt(tree, `${SITE_FILE}: contact.email`)
  })

  it("reports the Exhibit's front matter before its references", () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images: 'images:\n  - src: absent.png',
        links: 'links:\n  - label: Other\n    url: /exhibits#nope',
      }),
    }
    expectFailure(tree, `${INDEX}: images[0].alt: required`)
  })

  it('reports a reference before a link', () => {
    const tree = {
      ...VALID,
      [INDEX]: exhibitFile({
        images: 'images:\n  - src: absent.png\n    alt: A.',
        links: 'links:\n  - label: Other\n    url: /exhibits#nope',
      }),
    }
    expectFailure(tree, `${INDEX}: images[0].src: absent.png not found`)
  })

  it('reports a link before a caption', () => {
    const tree = {
      ...VALID,
      [SITE_FILE]: SITE.replace('Found it.', 'Found it'),
      [INDEX]: exhibitFile({ links: 'links:\n  - label: Other\n    url: /exhibits#nope' }),
    }
    expectFailure(
      tree,
      `${INDEX}: links[0].url: /exhibits#nope is not a built route or a listed Exhibit`,
    )
  })

  it('reports a caption before the bio', () => {
    const tree = {
      ...without(VALID, `${DIR}/bio.md`),
      [SITE_FILE]: SITE.replace('Found it.', 'Found it'),
    }
    expectFailure(tree, `${SITE_FILE}: captions.zones.portfolio: must end with ., ! or ?`)
  })
})

describe('ContentError', () => {
  it('carries file and path and formats the message from them', () => {
    const error = new ContentError('content/x.md', 'images[0].alt', 'required')
    expect([error.name, error.file, error.path, error.message]).toEqual([
      'ContentError',
      'content/x.md',
      'images[0].alt',
      'content/x.md: images[0].alt: required',
    ])
    expect(new ContentError('content/x.md', '', 'not found').message).toBe(
      'content/x.md: not found',
    )
  })
})
