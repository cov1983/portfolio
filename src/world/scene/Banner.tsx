// The Banner: a marking on the Zone's ice, like a centre-ice logo (AC-13.2, Owner decision on #55).
// The Exhibit's title and hook are laid out by bannerLines.ts and drawn once in dark ink on a
// transparent canvas with the system font stack, so the ice shows between the letters; no font is
// downloaded and nothing is fetched (plan §3: drei's Text would fetch a Google font; AC-28.1). The
// plane lies flat where the model places it, its text's top pointing away from the Hub; it has no
// collider, the Puck drives over it.
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

import type { Banner as BannerLayout } from '../model/layout'
import { BANNER_TYPE, bannerLines, type Line, type Weight } from './bannerLines'
import { INK } from './colours'
import { MARKING_LIFT, MAX_ANISOTROPY, markingRotation } from './marking'

/** The canvas is this wide, so small glyphs stay sharp; its height follows the marking's shape. */
const PIXEL_WIDTH = 2048
const PADDING_PX = 96

function font(weight: Weight, px: number): string {
  return `${weight} ${String(px)}px system-ui, sans-serif`
}

/** The title and the hook lines in ink on a transparent canvas of the marking's shape. */
function drawBanner(banner: BannerLayout): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PIXEL_WIDTH
  canvas.height = Math.round((PIXEL_WIDTH * banner.rect.length) / banner.rect.width)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('the Banner needs a 2D canvas context')
  const measure = (text: string, weight: Weight, px: number) => {
    context.font = font(weight, px)
    return context.measureText(text).width
  }
  const room = { width: canvas.width - 2 * PADDING_PX, height: canvas.height - 2 * PADDING_PX }
  const lines = bannerLines(banner, measure, room)
  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const draw = (line: Line, weight: Weight) => {
    context.font = font(weight, line.px)
    // Stretched along the depth (BANNER_TYPE.stretch): the line's centre stays where the layout
    // puts it, its glyphs are drawn taller than wide.
    context.setTransform(1, 0, 0, BANNER_TYPE.stretch, 0, PADDING_PX + line.y)
    context.fillText(line.text, canvas.width / 2, 0)
  }
  draw(lines.title, 'bold')
  for (const line of lines.hook) draw(line, 'normal')
  return canvas
}

export function Banner({ banner }: { banner: BannerLayout }) {
  const gl = useThree((state) => state.gl)
  const texture = useMemo(() => {
    const canvasTexture = new CanvasTexture(drawBanner(banner))
    canvasTexture.colorSpace = SRGBColorSpace
    // The canvas's top row maps to the plane's local +y (three's default, stated so it cannot
    // change unseen): marking.test proves that +y, the text's top, points away from the Hub.
    canvasTexture.flipY = true
    canvasTexture.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), MAX_ANISOTROPY)
    return canvasTexture
  }, [banner, gl])
  useEffect(
    () => () => {
      texture.dispose()
    },
    [texture],
  )
  const { rect } = banner
  return (
    <mesh
      position={[rect.centre.x, MARKING_LIFT, rect.centre.z]}
      rotation={markingRotation(banner.up)}
      renderOrder={1}
    >
      <planeGeometry args={[rect.width, rect.length]} />
      <meshStandardMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </mesh>
  )
}
