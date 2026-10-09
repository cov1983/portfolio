// Instrument for the CI performance budget (docs/spec/increment-1.md, AC-4.1 "World playable"):
// a user-timing mark that Lighthouse reads from the user-timings audit. Provisional: the plan for
// increment-1 picks the final instrument. Recorded once per page load.
export const WORLD_PLAYABLE_MARK = 'world-playable'

export type MarkRecorder = Pick<Performance, 'mark' | 'getEntriesByName'>

/** Records the mark unless it already exists. Returns true when this call recorded it. */
export function markWorldPlayable(recorder: MarkRecorder): boolean {
  if (recorder.getEntriesByName(WORLD_PLAYABLE_MARK, 'mark').length > 0) {
    return false
  }
  recorder.mark(WORLD_PLAYABLE_MARK)
  return true
}
