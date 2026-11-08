import type { Content } from '../content/types.ts'
import { Mark } from './Mark'

// The hero (spec increment-2 US-2, AC-2.1, 2.2; D2 option (a), D6; plan §2): the Title Screen's
// headline over a static backdrop that quotes the World, with no WebGL and no World bundle. The
// backdrop is decoration, hidden from assistive technology: the navy of the token layer, a grid
// with crosses tilted like the ice under the Follow Camera (site.css, `.hero-grid`), the Puck where
// the camera looks (the unchanged Mark, its drawing, in a wrapper that sizes it) and the static
// blue edge glow, the second of the site's two effects. The first is the headline reveal, a CSS
// keyframe animation whose resting state is the visible headline, so a page without script shows
// it (AC-2.2); reduced motion switches it off (site.css, AC-2.4). Strokes and fills are classes
// (site.css), never colour literals, and nothing is a style attribute (ADR 0012). The SVG's
// pattern id is unique: the hero renders once, on `/`.
type Props = { content: Content }

export function Hero({ content }: Props) {
  return (
    <header className="hero">
      <div className="hero-backdrop" aria-hidden="true">
        <svg className="hero-grid" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-grid-cell" width="64" height="64" patternUnits="userSpaceOnUse">
              <path className="grid-line" d="M64 0H0V64" />
              <path className="grid-cross" d="M32 26V38M26 32H38" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid-cell)" />
        </svg>
        <span className="hero-puck">
          <Mark />
        </span>
        <div className="edge-glow" />
      </div>
      <div className="headline">
        <h1>{content.owner.name}</h1>
        <p className="one-line">{content.oneLine}</p>
      </div>
    </header>
  )
}
