import { describe, expect, it } from 'vitest'

import { markOnce, WORLD_PLAYABLE_MARK, type MarkRecorder } from './marks'

function fakeRecorder(): MarkRecorder & { names: string[] } {
  const names: string[] = []
  return {
    names,
    mark(name: string) {
      names.push(name)
      return { name } as PerformanceMark
    },
    getEntriesByName(name: string) {
      return names.filter((n) => n === name).map((n) => ({ name: n }) as PerformanceEntry)
    },
  }
}

describe('markOnce', () => {
  it('records the mark on the first call', () => {
    const recorder = fakeRecorder()
    expect(markOnce(recorder, WORLD_PLAYABLE_MARK)).toBe(true)
    expect(recorder.names).toEqual([WORLD_PLAYABLE_MARK])
  })

  it('does not record a second mark of the same name', () => {
    const recorder = fakeRecorder()
    markOnce(recorder, WORLD_PLAYABLE_MARK)
    expect(markOnce(recorder, WORLD_PLAYABLE_MARK)).toBe(false)
    expect(recorder.names).toHaveLength(1)
  })

  it('records marks of different names independently', () => {
    const recorder = fakeRecorder()
    markOnce(recorder, WORLD_PLAYABLE_MARK)
    expect(markOnce(recorder, 'other')).toBe(true)
    expect(recorder.names).toEqual([WORLD_PLAYABLE_MARK, 'other'])
  })
})
