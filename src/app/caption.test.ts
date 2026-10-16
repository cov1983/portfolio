import { describe, expect, it } from 'vitest'

import type { ExhibitId } from '../content/types.ts'
import { CAPTION_MS, captionText, captionTimer } from './caption.ts'

const zone = 'portfolio' as ExhibitId
const captions = { hub: 'Welcome to the rink!', zones: { [zone]: 'Shoot to open it.' } }

describe('captionText', () => {
  it('gives the welcome for the Hub (AC-5.1)', () => {
    expect(captionText(captions, 'hub')).toBe('Welcome to the rink!')
  })

  it('gives the Zone its own caption (AC-13.1)', () => {
    expect(captionText(captions, zone)).toBe('Shoot to open it.')
  })

  it('names a place that has no caption', () => {
    expect(() => captionText(captions, 'other' as ExhibitId)).toThrow('"other"')
  })
})

describe('captionTimer', () => {
  // A controlled clock: the test decides when a timeout fires and sees which handle was cleared.
  const HANDLE = 41
  function controlledHost() {
    const timeouts: { callback: () => void; delay: number }[] = []
    const cleared: number[] = []
    const host = {
      setTimeout: (callback: () => void, delay: number) => {
        timeouts.push({ callback, delay })
        return HANDLE
      },
      clearTimeout: (handle: number) => {
        cleared.push(handle)
      },
    }
    return { host, timeouts, cleared }
  }

  it('is about 5 s (spec, storytelling)', () => {
    expect(CAPTION_MS).toBe(5000)
  })

  it('schedules the expiry CAPTION_MS ahead', () => {
    const { host, timeouts } = controlledHost()
    captionTimer(host)(() => undefined)
    expect(timeouts.map((t) => t.delay)).toEqual([CAPTION_MS])
  })

  it('calls back once the timeout fires, not before', () => {
    const { host, timeouts } = controlledHost()
    let expired = 0
    captionTimer(host)(() => {
      expired += 1
    })
    expect(expired).toBe(0)
    timeouts[0]?.callback()
    expect(expired).toBe(1)
  })

  it('cancels the timeout it scheduled', () => {
    const { host, cleared } = controlledHost()
    const cancel = captionTimer(host)(() => undefined)
    cancel()
    expect(cleared).toEqual([HANDLE])
  })
})
