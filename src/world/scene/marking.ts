// Markings on the ice (plan §5, corrected by #55): how high they sit and how a flat marking is
// turned so its text reads upright. Pure: three's Euler is plain maths, no WebGL.
import { Euler } from 'three'

import type { Vec2 } from '../model/layout'

/** The painted lines' thickness above the ice (Solid.tsx's IceLine), metres. */
export const LINE_HEIGHT = 0.01
/**
 * The Banner lies 2 mm above the lines' tops, so it never shares a depth with the ice or a line;
 * its material's polygon offset keeps it in front where the depth buffer is coarse (Banner.tsx).
 */
export const MARKING_LIFT = LINE_HEIGHT + 0.002

/**
 * The rotation that lays a plane (drawn in its local x–y, facing +z) flat on the ice facing up,
 * with its local +y, the top of its text, pointing along `up` on the ice. 'YXZ': the plane is first
 * laid down about x (its top then points to −z), then turned about the vertical.
 */
export function markingRotation(up: Vec2): Euler {
  return new Euler(-Math.PI / 2, Math.atan2(-up.x, -up.z), 0, 'YXZ')
}
