import { describe, expect, it } from 'vitest'

import { COARSE_POINTER_QUERY, detectCapability } from './capability.ts'

describe('detectCapability', () => {
  it('reports a coarse pointer when the media query matches', () => {
    const queries: string[] = []
    const capability = detectCapability((query) => {
      queries.push(query)
      return { matches: true }
    })
    expect(capability).toEqual({ coarsePointer: true })
    expect(queries).toEqual([COARSE_POINTER_QUERY])
  })

  it('reports a fine pointer when it does not', () => {
    expect(detectCapability(() => ({ matches: false }))).toEqual({ coarsePointer: false })
  })

  it('asks for the pointer media feature', () => {
    expect(COARSE_POINTER_QUERY).toBe('(pointer: coarse)')
  })
})
