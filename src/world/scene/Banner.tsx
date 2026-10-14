// The Banner behind a Goal: the Exhibit's title and hook drawn once on a canvas with the system
// font stack, one line each, and shown as a texture on an upright plane facing the Hub, where the
// model places it. No font is downloaded and nothing is fetched (plan §3: drei's Text would fetch
// a Google font; AC-28.1).
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

import type { Banner as BannerWords, BannerPlace } from '../model/layout'

/** The canvas is this wide; its height follows the plane's shape. Wide enough for small glyphs to stay sharp. */
const PIXEL_WIDTH = 2048
const BACKGROUND = '#0b1a2a'
const INK = '#ffffff'
const PADDING_PX = 96
/**
 * Each line's centre and largest font, as fractions of the canvas height. Both lines sit in the
 * sign's upper band, centred where the single line was (0.35): the net in front hides the lower
 * part along the camera's line of sight.
 */
const LINES = [
  { at: 0.22, largest: 0.22, weight: 'bold' },
  { at: 0.48, largest: 0.17, weight: 'normal' },
] as const

function font(weight: string, px: number): string {
  return `${weight} ${String(px)}px system-ui, sans-serif`
}

/**
 * The two lines centred on a dark canvas of the plane's shape. A line too wide at its largest font
 * is scaled down until it fits between the paddings, with no floor and no ellipsis: every word of
 * the title and the hook stays on the sign (AC-13.2; plan §5, corrected by T7, #31).
 */
function drawBanner(lines: BannerWords['lines'], place: BannerPlace): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PIXEL_WIDTH
  canvas.height = Math.round((PIXEL_WIDTH * place.height) / place.width)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('the Banner needs a 2D canvas context')
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const room = canvas.width - 2 * PADDING_PX
  lines.forEach((text, i) => {
    const line = LINES[i]
    if (line === undefined) return
    const largest = Math.round(canvas.height * line.largest)
    context.font = font(line.weight, largest)
    // Text width grows with the font size, so one measurement gives the size that fits.
    const width = context.measureText(text).width
    const px = width <= room ? largest : Math.floor((largest * room) / width)
    context.font = font(line.weight, px)
    context.fillText(text, canvas.width / 2, canvas.height * line.at)
  })
  return canvas
}

export function Banner({ lines, place }: { lines: BannerWords['lines']; place: BannerPlace }) {
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawBanner(lines, place))
    canvasTexture.colorSpace = SRGBColorSpace
    return canvasTexture
  }, [lines, place])
  useEffect(
    () => () => {
      texture.dispose()
    },
    [texture],
  )
  return (
    <mesh position={[place.centre.x, place.centre.y, place.centre.z]}>
      <planeGeometry args={[place.width, place.height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
