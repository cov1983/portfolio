// How the Banner's words are laid out on its canvas (plan §5, corrected by #55): the title on one
// line, the hook on one or two, every word kept, no ellipsis (AC-13.2). Pure: the text's width is
// measured by the caller (the canvas's measureText in Banner.tsx, a fake in the tests).

export type Weight = 'bold' | 'normal'
/** The width in pixels of `text` drawn at `px` in `weight`. */
export type Measure = (text: string, weight: Weight, px: number) => number
/** One drawn line: its text, font size and the vertical centre of its glyphs, all in pixels. */
export type Line = { text: string; px: number; y: number }
export type BannerLines = { title: Line; hook: [Line] | [Line, Line] }

/**
 * Font sizes as fractions of the canvas height, before they shrink to fit, and how the lines stack:
 * `leading` is a line's height as a multiple of its font size, `stretch` how much taller than wide
 * the glyphs are drawn: like a road marking, text lying on the ice is foreshortened along the view,
 * so it is drawn stretched along the depth to read with normal proportions on the approach. At
 * their largest, a title and two hook lines fill the canvas: 1.15 × 2 × (0.17 + 2 × 0.13) < 1.
 */
export const BANNER_TYPE = { title: 0.17, hook: 0.13, leading: 1.15, stretch: 2 }

export type Room = { width: number; height: number }

/**
 * The largest size up to `largest` at which a text `measured` wide at `largest` fits `width`: text
 * width grows linearly with the font size, so one measurement gives the size that fits.
 */
function fitted(largest: number, measured: number, width: number): number {
  return measured <= width ? largest : Math.floor((largest * width) / measured)
}

/**
 * The hook in two lines broken at the space that makes the longer line shortest. Splitting and
 * joining on single spaces keeps the text exact: the two lines joined with a space are the hook.
 */
function balancedSplit(hook: string, measure: Measure, px: number): [string, string] | null {
  const words = hook.split(' ')
  let best: { lines: [string, string]; width: number } | null = null
  for (let i = 1; i < words.length; i += 1) {
    const lines: [string, string] = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
    const width = Math.max(...lines.map((line) => measure(line, 'normal', px)))
    if (best === null || width < best.width) best = { lines, width }
  }
  return best?.lines ?? null
}

/** The title's and the hook's lines and sizes for a canvas of `room`, centred as one block. */
export function bannerLines(
  words: { title: string; hook: string },
  measure: Measure,
  room: Room,
  type = BANNER_TYPE,
): BannerLines {
  const titleLargest = Math.round(room.height * type.title)
  const hookLargest = Math.round(room.height * type.hook)
  const titlePx = fitted(titleLargest, measure(words.title, 'bold', titleLargest), room.width)
  const split =
    measure(words.hook, 'normal', hookLargest) > room.width
      ? balancedSplit(words.hook, measure, hookLargest)
      : null
  const hookTexts = split ?? [words.hook]
  const widest = Math.max(...hookTexts.map((text) => measure(text, 'normal', hookLargest)))
  const hookPx = fitted(hookLargest, widest, room.width)
  // The block's height, stretched along the depth; if it is taller than the canvas, every size
  // shrinks by the same factor.
  const pitch = type.leading * type.stretch
  const height = pitch * (titlePx + hookTexts.length * hookPx)
  const scale = height <= room.height ? 1 : room.height / height
  const title = Math.floor(titlePx * scale)
  const hook = Math.floor(hookPx * scale)
  const top = (room.height - pitch * (title + hookTexts.length * hook)) / 2
  const titleLine = { text: words.title, px: title, y: top + (pitch * title) / 2 }
  const hookLine = (text: string, i: number): Line => ({
    text,
    px: hook,
    y: top + pitch * title + pitch * hook * (i + 0.5),
  })
  return {
    title: titleLine,
    hook:
      split === null ? [hookLine(words.hook, 0)] : [hookLine(split[0], 0), hookLine(split[1], 1)],
  }
}
