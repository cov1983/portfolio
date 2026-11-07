import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { faviconFiles, ICO_SIZE, icoFromPng, renderPng } from './favicon.ts'

/** A 2 x 2 opaque square in an SVG, so the render is checkable pixel by pixel. */
const SQUARE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#000"/></svg>',
)

describe('icoFromPng', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
  const ico = icoFromPng(png, 32)

  it('opens with an ICONDIR of one icon entry', () => {
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0])
  })

  it('names the size, one colour plane, 32 bits and the PNG’s length and offset in the entry', () => {
    expect({
      width: ico[6],
      height: ico[7],
      planes: ico.readUInt16LE(10),
      bits: ico.readUInt16LE(12),
      length: ico.readUInt32LE(14),
      offset: ico.readUInt32LE(18),
    }).toEqual({ width: 32, height: 32, planes: 1, bits: 32, length: png.length, offset: 22 })
  })

  it('carries the PNG unchanged after the 22-byte header', () => {
    expect(ico.subarray(22).equals(png)).toBe(true)
  })

  it('writes 0 for a 256 px icon, as the format requires', () => {
    const large = icoFromPng(png, 256)
    expect([large[6], large[7]]).toEqual([0, 0])
  })
})

describe('renderPng', () => {
  it('renders an SVG to a PNG of the given size', async () => {
    const meta = await sharp(await renderPng(SQUARE, 4)).metadata()
    expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({
      format: 'png',
      width: 4,
      height: 4,
    })
  })
})

describe('faviconFiles', () => {
  it('derives favicon.svg as the mark’s bytes and favicon.ico from its render at ICO_SIZE', async () => {
    const sizes: number[] = []
    const files = await faviconFiles(SQUARE, (svg, size) => {
      sizes.push(size)
      return Promise.resolve(Buffer.concat([Buffer.from('png:'), svg.subarray(0, 4)]))
    })
    expect({
      names: files.map((file) => file.fileName),
      svg: files[0]?.source.equals(SQUARE),
      ico: files[1]?.source.equals(icoFromPng(Buffer.from('png:<svg'), ICO_SIZE)),
      sizes,
    }).toEqual({ names: ['favicon.svg', 'favicon.ico'], svg: true, ico: true, sizes: [ICO_SIZE] })
  })
})
