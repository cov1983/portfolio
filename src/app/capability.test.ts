import { describe, expect, it } from 'vitest'

import {
  attributeFailure,
  COARSE_POINTER_QUERY,
  detectCapability,
  probeWebgl,
  type ProbeCanvas,
} from './capability.ts'

const withWebgl = () => true
const withoutWebgl = () => false

describe('detectCapability', () => {
  it('reports a coarse pointer when the media query matches', () => {
    const queries: string[] = []
    const capability = detectCapability((query) => {
      queries.push(query)
      return { matches: true }
    }, withWebgl)
    expect(capability).toEqual({ coarsePointer: true, webgl: true })
    expect(queries).toEqual([COARSE_POINTER_QUERY])
  })

  it('reports a fine pointer when it does not', () => {
    expect(detectCapability(() => ({ matches: false }), withWebgl)).toEqual({
      coarsePointer: false,
      webgl: true,
    })
  })

  it('reports WebGL as the probe found it (AC-22.1)', () => {
    expect(detectCapability(() => ({ matches: false }), withoutWebgl).webgl).toBe(false)
  })
})

describe('probeWebgl', () => {
  /** A canvas whose contexts of the given kinds exist, recording what the probe asked and released. */
  function canvas(kinds: ('webgl2' | 'webgl')[], log: string[]): ProbeCanvas {
    return {
      getContext: (id: 'webgl2' | 'webgl') => {
        log.push(`get ${id}`)
        if (!kinds.includes(id)) return null
        return {
          getExtension: () => ({
            loseContext: () => {
              log.push(`lose ${id}`)
            },
          }),
        }
      },
    }
  }

  it('finds WebGL 2 and releases the context it took', () => {
    const log: string[] = []
    expect(probeWebgl(() => canvas(['webgl2', 'webgl'], log))).toBe(true)
    expect(log).toEqual(['get webgl2', 'lose webgl2'])
  })

  it('reports no WebGL when the browser has WebGL 1 only: three renders with WebGL 2 alone', () => {
    const log: string[] = []
    expect(probeWebgl(() => canvas(['webgl'], log))).toBe(false)
    expect(log).toEqual(['get webgl2'])
  })

  it('reports no WebGL when the canvas gives no context', () => {
    const log: string[] = []
    expect(probeWebgl(() => canvas([], log))).toBe(false)
    expect(log).toEqual(['get webgl2'])
  })

  it('tolerates a browser without the release extension', () => {
    const probe: ProbeCanvas = { getContext: () => ({ getExtension: () => null }) }
    expect(probeWebgl(() => probe)).toBe(true)
  })
})

describe('attributeFailure', () => {
  const render = { kind: 'render', message: 'Error creating WebGL context.' } as const

  it('names a render throw without WebGL the WebGL failure (Owner, #33 Q2)', () => {
    expect(attributeFailure(render, { coarsePointer: false, webgl: false })).toEqual({
      kind: 'webgl',
      message: render.message,
    })
  })

  it('leaves a render throw with WebGL, or before detection, as it came', () => {
    expect(attributeFailure(render, { coarsePointer: false, webgl: true })).toBe(render)
    expect(attributeFailure(render, null)).toBe(render)
  })

  it('leaves the other kinds as they came', () => {
    const physics = { kind: 'physics', message: 'wasm refused' } as const
    expect(attributeFailure(physics, { coarsePointer: false, webgl: false })).toBe(physics)
  })
})
