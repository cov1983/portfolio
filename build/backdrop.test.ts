import { describe, expect, it } from 'vitest'

import { RIG } from '../src/world/model/camera.ts'
import {
  BACKDROP_FILE,
  backdropFiles,
  backdropSvg,
  clip,
  crossPath,
  gridPath,
  project,
  tokenColours,
  VIEW,
} from './backdrop.ts'

const TOKENS = `@theme static {
  --color-background: #0B1A2A;
  --color-border: #23405e;
  --color-primary: #168bff;
  --color-glow: #168bff59;
}`
const COLOURS = { background: '#0b1a2a', border: '#23405e', primary: '#168bff', glow: '#168bff59' }

/** Every coordinate pair of a path's data. */
function points(path: string): [number, number][] {
  return [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ])
}

describe('tokenColours', () => {
  it('reads the four colours from the token layer, lowercased, the glow with its alpha', () => {
    expect(tokenColours(TOKENS)).toEqual(COLOURS)
  })

  it('fails naming a missing token', () => {
    expect(() => tokenColours(TOKENS.replace(/--color-glow[^;]*;/, ''))).toThrow('--color-glow')
  })
})

describe('project', () => {
  it('puts the ice under the Puck at the centre of the view, where the camera looks', () => {
    const [x, y] = project(0, 0)
    expect(x).toBeCloseTo(VIEW.width / 2, 9)
    expect(y).toBeCloseTo(VIEW.height / 2, 9)
  })

  it('draws the far ice higher and narrower than the near ice', () => {
    const [farLeft, farY] = project(-1, -5)
    const [farRight] = project(1, -5)
    const [nearLeft, nearY] = project(-1, 5)
    const [nearRight] = project(1, 5)
    expect(farY).toBeLessThan(nearY)
    expect(farRight - farLeft).toBeLessThan(nearRight - nearLeft)
  })

  it('follows the rig: a wider field of view draws the same cell smaller', () => {
    const wide = { ...RIG, fovDeg: 70 }
    const width = (rig: typeof RIG) => project(1, 0, rig)[0] - project(0, 0, rig)[0]
    expect(width(wide)).toBeLessThan(width(RIG))
  })
})

describe('clip', () => {
  it('keeps a segment inside the view as it is', () => {
    expect(clip([10, 10], [20, 30])).toEqual([
      [10, 10],
      [20, 30],
    ])
  })

  it('cuts a segment crossing the view at its edges', () => {
    expect(clip([-100, 450], [1700, 450])).toEqual([
      [0, 450],
      [1600, 450],
    ])
  })

  it('drops a segment wholly outside the view', () => {
    expect(clip([-10, -10], [-5, 1000])).toBeNull()
  })

  it('drops a segment along an edge line but outside the view', () => {
    expect(clip([100, -5], [200, -5])).toBeNull()
  })

  it('drops a segment that passes beside a corner', () => {
    expect(clip([-50, 20], [20, -50])).toBeNull()
  })
})

describe('the drawing', () => {
  it('keeps every grid and cross point inside the view', () => {
    const outside = points(gridPath() + crossPath()).filter(
      ([x, y]) => x < 0 || x > VIEW.width || y < 0 || y > VIEW.height,
    )
    expect(outside).toEqual([])
  })

  it('draws crosses at one cell centre in four, two arms each', () => {
    // 354 crosses: (g) of the #103 probe, every second centre along each axis (Owner, #103
    // comment 6726409397); every centre would be 1376.
    expect(points(crossPath()).length / 4).toBe(354)
  })

  it('draws the grid with the lines the view shows', () => {
    expect(points(gridPath()).length / 2).toBe(122)
  })

  it('writes no animation, style or script into the file: the glow is static (AC-1.2)', () => {
    const svg = backdropSvg(COLOURS)
    expect(svg).not.toMatch(/<(animate|animateTransform|animateMotion|set|style|script)\b/)
    expect(svg).not.toMatch(/\sstyle=/)
  })

  it('paints the foot fade as an alpha mask in the background token', () => {
    const svg = backdropSvg(COLOURS)
    expect(svg).toMatch(/<mask\b[^>]*\bmask-type="alpha"/)
    expect(svg).toContain(`stop-color="${COLOURS.background}" stop-opacity="0"`)
  })
})

describe('backdropFiles', () => {
  it('emits hero-backdrop.svg as an SVG document of the 1600 × 900 view', () => {
    const files = backdropFiles(TOKENS)
    expect(files.map((file) => file.fileName)).toEqual([BACKDROP_FILE])
    expect(files[0]?.source.toString()).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1600" height="900" viewBox="0 0 1600 900">/,
    )
  })
})
