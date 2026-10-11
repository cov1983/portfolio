// The Banner over a Goal: its text drawn once on a canvas with the system font stack and shown as
// a texture on a plane facing the Hub. No font is downloaded and nothing is fetched (plan §3:
// drei's Text would fetch a Google font; AC-28.1).
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

import type { Vec3 } from '../model/layout'

/** The plane in metres and the canvas in pixels: the same 4:1 shape. */
const PLANE = { width: 8, height: 2 }
const PIXELS = { width: 1024, height: 256 }
const BACKGROUND = '#0b1a2a'
const INK = '#ffffff'
const LARGEST_FONT_PX = 88
const SMALLEST_FONT_PX = 32
const PADDING_PX = 48

function font(px: number): string {
  return `bold ${String(px)}px system-ui, sans-serif`
}

/** The text centred on a dark canvas, shrunk until it fits between the paddings. */
function drawBanner(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PIXELS.width
  canvas.height = PIXELS.height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('the Banner needs a 2D canvas context')
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, PIXELS.width, PIXELS.height)
  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  let px = LARGEST_FONT_PX
  context.font = font(px)
  while (context.measureText(text).width > PIXELS.width - 2 * PADDING_PX && px > SMALLEST_FONT_PX) {
    px -= 4
    context.font = font(px)
  }
  context.fillText(text, PIXELS.width / 2, PIXELS.height / 2)
  return canvas
}

export function Banner({ text, position }: { text: string; position: Vec3 }) {
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawBanner(text))
    canvasTexture.colorSpace = SRGBColorSpace
    return canvasTexture
  }, [text])
  useEffect(
    () => () => {
      texture.dispose()
    },
    [texture],
  )
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <planeGeometry args={[PLANE.width, PLANE.height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
