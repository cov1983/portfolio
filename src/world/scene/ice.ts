// The ice texture's mapping (#55): one texture over the Hub, the Path and the Zone, laid in world
// space so the three slabs are one continuous ice with no seam where they meet. Pure.
import type { Rect } from '../model/layout'

/** ice.webp's size in pixels (`make ice-texture`). */
export const ICE_PIXELS = { width: 1363, height: 383 }

/** One tile of the texture on the ice, metres: 6 m across, its depth from the image's aspect. */
export const TILE = { width: 6, length: (6 * ICE_PIXELS.height) / ICE_PIXELS.width }

/**
 * The UVs of a one-segment plane laid flat over `rect` (three's PlaneGeometry vertex order: far
 * left, far right, near left, near right, once the plane is turned down about x), in tiles of world
 * space: u grows with x, v away from the camera (−z), so the texture's top points up the World.
 */
export function iceUv(rect: Rect, tile = TILE): number[] {
  const left = (rect.centre.x - rect.width / 2) / tile.width
  const right = (rect.centre.x + rect.width / 2) / tile.width
  const far = -(rect.centre.z - rect.length / 2) / tile.length
  const near = -(rect.centre.z + rect.length / 2) / tile.length
  return [left, far, right, far, left, near, right, near]
}
