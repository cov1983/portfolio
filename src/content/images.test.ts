import { describe, expect, it } from 'vitest'

import { imageSet, planVariants, sourceFormat, VARIANT_WIDTHS } from './images'
import type { ExhibitId } from './types'

// AC-27.1, the plan half (plan §4): AVIF and WebP at 480, 960 and 1440 capped at the source width,
// plus a fallback in the source format at the largest width; names <name>-<w>.<ext>; the original
// is never referenced. The encoder (build/images.ts) writes what this plan says.
const ID = 'portfolio' as ExhibitId

function widthsOf(format: string, plan: ReturnType<typeof planVariants>): number[] {
  return plan.variants.filter((v) => v.format === format).map((v) => v.width)
}

describe('planVariants', () => {
  it('plans 480, 960 and 1440 for an 1800-wide source', () => {
    const plan = planVariants('workflow-one-page.png', { width: 1800, height: 1580 })
    expect(widthsOf('avif', plan)).toEqual([480, 960, 1440])
    expect(widthsOf('webp', plan)).toEqual([480, 960, 1440])
  })

  it('caps the last width at the source width (1000 → 480, 960, 1000)', () => {
    const plan = planVariants('photo.jpg', { width: 1000, height: 500 })
    expect(widthsOf('avif', plan)).toEqual([480, 960, 1000])
  })

  it('plans one variant per format for a source narrower than 480', () => {
    const plan = planVariants('photo.png', { width: 16, height: 12 })
    expect(widthsOf('avif', plan)).toEqual([16])
    expect(widthsOf('webp', plan)).toEqual([16])
    expect(widthsOf('png', plan)).toEqual([16])
  })

  it('keeps the aspect ratio in every variant height', () => {
    const plan = planVariants('photo.png', { width: 1800, height: 1580 })
    expect(plan.variants.map((v) => [v.width, v.height])).toEqual(
      expect.arrayContaining([
        [480, 421],
        [960, 843],
        [1440, 1264],
      ]),
    )
  })

  it('names every file <name>-<width>.<ext>', () => {
    const plan = planVariants('photo.png', { width: 1000, height: 500 })
    expect(plan.variants.map((v) => v.file).sort()).toEqual([
      'photo-1000.avif',
      'photo-1000.png',
      'photo-1000.webp',
      'photo-480.avif',
      'photo-480.webp',
      'photo-960.avif',
      'photo-960.webp',
    ])
  })

  it('fallback keeps the source format at the largest width (png → png, jpg → jpeg as .jpg)', () => {
    const png = planVariants('photo.png', { width: 1800, height: 1580 })
    expect(png.fallback).toEqual({
      file: 'photo-1440.png',
      format: 'png',
      width: 1440,
      height: 1264,
    })
    const jpg = planVariants('photo.jpg', { width: 1000, height: 500 })
    expect(jpg.fallback).toEqual({
      file: 'photo-1000.jpg',
      format: 'jpeg',
      width: 1000,
      height: 500,
    })
  })

  it('exposes the three target widths', () => {
    expect(VARIANT_WIDTHS).toEqual([480, 960, 1440])
  })
})

describe('sourceFormat', () => {
  it('reads png, jpg and jpeg in any case; anything else is undefined', () => {
    expect(sourceFormat('a.png')).toBe('png')
    expect(sourceFormat('a.JPG')).toBe('jpeg')
    expect(sourceFormat('a.jpeg')).toBe('jpeg')
    expect(sourceFormat('a.gif')).toBeUndefined()
    expect(sourceFormat('a')).toBeUndefined()
  })
})

describe('imageSet', () => {
  const plan = planVariants('photo.png', { width: 1800, height: 1580 })
  const set = imageSet(ID, plan, 'A flowchart.')

  it('lists avif before webp, each with a three-entry srcset under /media/exhibits/<id>/', () => {
    expect(set.sources).toEqual([
      {
        type: 'image/avif',
        srcset:
          '/media/exhibits/portfolio/photo-480.avif 480w, /media/exhibits/portfolio/photo-960.avif 960w, /media/exhibits/portfolio/photo-1440.avif 1440w',
      },
      {
        type: 'image/webp',
        srcset:
          '/media/exhibits/portfolio/photo-480.webp 480w, /media/exhibits/portfolio/photo-960.webp 960w, /media/exhibits/portfolio/photo-1440.webp 1440w',
      },
    ])
  })

  it('carries the §5 sizes string, the alt text and the largest variant dimensions', () => {
    expect(set.sizes).toBe('(max-width: 800px) 100vw, 720px')
    expect(set.alt).toBe('A flowchart.')
    expect([set.width, set.height]).toEqual([1440, 1264])
  })

  it('points the fallback at the largest variant in the source format', () => {
    expect(set.fallback).toBe('/media/exhibits/portfolio/photo-1440.png')
  })

  it('never references the original file name', () => {
    expect(JSON.stringify(set)).not.toContain('photo.png')
  })
})
