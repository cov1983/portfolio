// WCAG 2.2 contrast for the token layer's colours (tokens.test.ts; ai-review round 1 on #125, m2):
// axe cannot resolve text over a gradient, so the hero's text over the edge glow is computed from
// tokens.css instead. Pure: #rrggbb and #rrggbbaa in, numbers out.

export type Rgb = readonly [number, number, number]

/** The channels (0–255) and alpha (0–1) of a #rrggbb or #rrggbbaa colour. */
export function parseHex(hex: string): { rgb: Rgb; alpha: number } {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(hex)
  if (match === null) throw new Error(`not a #rrggbb or #rrggbbaa colour: ${hex}`)
  const [, r = '', g = '', b = '', a] = match
  return {
    rgb: [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)],
    alpha: a === undefined ? 1 : parseInt(a, 16) / 255,
  }
}

/** `top` painted over the opaque `bottom` at `top`'s alpha (source-over in sRGB, as browsers blend). */
export function over(top: string, bottom: string): Rgb {
  const { rgb: front, alpha } = parseHex(top)
  const { rgb: back } = parseHex(bottom)
  const mix = (i: 0 | 1 | 2): number => front[i] * alpha + back[i] * (1 - alpha)
  return [mix(0), mix(1), mix(2)]
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number): number => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio between two opaque colours, 1–21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
