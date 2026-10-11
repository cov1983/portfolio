// Instruments for the CI performance budget (docs/spec/increment-1.md, Non-functional
// requirements; plan §5, §7): user-timing marks that Lighthouse reads from its user-timings audit.
// Each is recorded once per page load.

/** First frame after Rapier initialised with the key listener attached (plan §7 line 2). */
export const WORLD_PLAYABLE_MARK = 'world-playable'

export type MarkRecorder = Pick<Performance, 'mark' | 'getEntriesByName'>

/** Records the mark `name` unless it already exists. Returns true when this call recorded it. */
export function markOnce(recorder: MarkRecorder, name: string): boolean {
  if (recorder.getEntriesByName(name, 'mark').length > 0) {
    return false
  }
  recorder.mark(name)
  return true
}
