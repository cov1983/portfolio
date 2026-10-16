// The Announcer caption's text and its ~5 s (spec, storytelling: each caption appears once per
// place per page load and disappears after about 5 s or when a Panel opens; plan §5, corrected by
// #32). The store holds the place only (T5a trim); the text is the Content's, looked up where the
// caption renders. The timer runs on an injected host, so the 5 s are unit-tested without waiting.
import type { Content } from '../content/types.ts'
import type { CaptionPlace } from './store.ts'

/** How long a shown caption stays: "about 5 s". */
export const CAPTION_MS = 5000

/** The host's timer functions; `window` fits. */
export type TimerHost = {
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (handle: number) => void
}

/** The caption's text for `place`; validator check 6 gives every Zone one, so a miss is a bug. */
export function captionText(captions: Content['captions'], place: CaptionPlace): string {
  const text = place === 'hub' ? captions.hub : captions.zones[place]
  if (text === undefined) throw new Error(`no Announcer caption for the place "${place}"`)
  return text
}

/** Calls `onExpire` once CAPTION_MS have passed and returns the function that cancels it. */
export function captionTimer(host: TimerHost): (onExpire: () => void) => () => void {
  return (onExpire) => {
    const handle = host.setTimeout.call(host, onExpire, CAPTION_MS)
    return () => {
      host.clearTimeout.call(host, handle)
    }
  }
}
