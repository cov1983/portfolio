// The favicon pair, derived from the mark (spec increment-2 AC-1.3, D8; ADR 0017; Owner on #100,
// comments 6705559367 and 6705619580): src/site/mark.svg is the one drawing; the build writes its
// bytes as favicon.svg and a 32 px PNG of it in an ICO directory as favicon.ico, at the root of
// the output, and the dev server serves the same two (vite.config.ts). The header mark is an
// <img> of /favicon.svg, so the icon link and the mark name one emitted file. The ICO directory is
// the one of #75 (one PNG entry); build/build.ts and vite.config.ts are the I/O.
import sharp from 'sharp'

import type { EmittedFile } from './images.ts'

/** The mark's one drawing, relative to the repository root. */
export const MARK_SOURCE = 'src/site/mark.svg'
/** The ICO's one image: 32 px, what a browser's self-request for /favicon.ico shows. */
export const ICO_SIZE = 32

/** The ICONDIR (6 bytes) and one ICONDIRENTRY (16 bytes) before the image data. */
const HEADER_BYTES = 22

/** A one-entry ICO holding `png` (`size` px square); the format writes 256 as 0. */
export function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(HEADER_BYTES)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one entry
  header[6] = size % 256 // width
  header[7] = size % 256 // height
  header.writeUInt16LE(1, 10) // colour planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(png.length, 14) // image bytes
  header.writeUInt32LE(HEADER_BYTES, 18) // image offset
  return Buffer.concat([header, png])
}

/** An SVG rendered by sharp to a `size` px square PNG. */
export function renderPng(svg: Buffer, size: number): Promise<Buffer> {
  return sharp(svg).resize(size, size).png().toBuffer()
}

/** favicon.svg (the mark's bytes) and favicon.ico (its render at ICO_SIZE), for the output root. */
export async function faviconFiles(
  mark: Buffer,
  render: (svg: Buffer, size: number) => Promise<Buffer>,
): Promise<EmittedFile[]> {
  const png = await render(mark, ICO_SIZE)
  return [
    { fileName: 'favicon.svg', source: mark },
    { fileName: 'favicon.ico', source: icoFromPng(png, ICO_SIZE) },
  ]
}
