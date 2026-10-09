import { describe, expect, it } from 'vitest'

import { markWorldPlayable, WORLD_PLAYABLE_MARK, type MarkRecorder } from './world-playable'

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

describe('markWorldPlayable', () => {
  it('records the world-playable mark on the first call', () => {
    const recorder = fakeRecorder()
    expect(markWorldPlayable(recorder)).toBe(true)
    expect(recorder.names).toEqual([WORLD_PLAYABLE_MARK])
  })

  it('does not record a second mark on later calls', () => {
    const recorder = fakeRecorder()
    markWorldPlayable(recorder)
    expect(markWorldPlayable(recorder)).toBe(false)
    expect(recorder.names).toHaveLength(1)
  })
})
