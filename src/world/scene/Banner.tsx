// The Banner behind a Goal: its text drawn once on a canvas with the system font stack and shown
// as a texture on an upright plane facing the Hub, where the model places it. No font is
// downloaded and nothing is fetched (plan §3: drei's Text would fetch a Google font; AC-28.1).
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

import type { BannerPlace } from '../model/layout'

/** The canvas is this wide; its height follows the plane's shape. */
const PIXEL_WIDTH = 1024
const BACKGROUND = '#0b1a2a'
const INK = '#ffffff'
const LARGEST_FONT_PX = 88
const SMALLEST_FONT_PX = 32
const PADDING_PX = 48
/** The text sits in the sign's upper band: the net in front hides the lower part along the camera's line of sight. */
const TEXT_LINE = 0.35

function font(px: number): string {
  return `bold ${String(px)}px system-ui, sans-serif`
}

/** The text centred on a dark canvas of the plane's shape, shrunk until it fits between the paddings. */
function drawBanner(text: string, place: BannerPlace): HTMLCanvasElement {
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
  let px = Math.min(LARGEST_FONT_PX, canvas.height - 2 * PADDING_PX)
  context.font = font(px)
  while (context.measureText(text).width > canvas.width - 2 * PADDING_PX && px > SMALLEST_FONT_PX) {
    px -= 4
    context.font = font(px)
  }
  context.fillText(text, canvas.width / 2, canvas.height * TEXT_LINE)
  return canvas
}

export function Banner({ text, place }: { text: string; place: BannerPlace }) {
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawBanner(text, place))
    canvasTexture.colorSpace = SRGBColorSpace
    return canvasTexture
  }, [text, place])
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
