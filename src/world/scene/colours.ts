// The World's ice and ink colours, and the contrast between them (Owner decision on #55, Q4).

/** The ice's colour; the ice texture is pulled towards it (scripts/ice-texture.ts). */
export const ICE_COLOUR = '#eef4f8'
/** The Banner's ink: dark and solid on the light ice. */
export const INK = '#0b1a2a'

/** An sRGB colour as `#rrggbb` or as its three 8-bit channels. */
export type Colour = string | readonly [r: number, g: number, b: number]

function channels(colour: Colour): readonly [number, number, number] {
  if (typeof colour !== 'string') return colour
  if (!/^#[0-9a-f]{6}$/i.test(colour)) throw new Error(`not a #rrggbb colour: ${colour}`)
  const at = (i: number) => Number.parseInt(colour.slice(i, i + 2), 16)
  return [at(1), at(3), at(5)]
}

function linear(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.2 relative luminance. */
export function relativeLuminance(colour: Colour): number {
  const [r, g, b] = channels(colour)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.2 contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: Colour, b: Colour): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
