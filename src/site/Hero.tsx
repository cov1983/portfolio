import type { Content } from '../content/types.ts'
import { Mark } from './Mark'

// The hero (spec increment-2 US-2, AC-2.1, 2.2; D2 option (a), D6; plan §2): the Title Screen's
// headline over a static backdrop that quotes the World, with no WebGL and no World bundle. The
// backdrop is decoration, hidden from assistive technology: one image the build derives,
// /hero-backdrop.svg (build/backdrop.ts; Owner, #103 comment 6726409397), shown as the element's
// background (site.css), with the ice grid tilted as under the Follow Camera, its crosses, the static
// blue edge glow (the second of the site's two effects) and the foot fade drawn in, and over its
// centre the Puck where the camera looks (the unchanged Mark, in a wrapper that sizes it). The
// first effect is the headline reveal, a CSS keyframe animation whose resting state is the visible
// headline, so a page without script shows it (AC-2.2); reduced motion switches it off (site.css,
// AC-2.4). Nothing is a style attribute (ADR 0012).
type Props = { content: Content }

export function Hero({ content }: Props) {
  return (
    <header className="hero">
      <div className="hero-backdrop" aria-hidden="true">
        <span className="hero-puck">
          <Mark />
        </span>
      </div>
      <div className="headline">
        <h1>{content.owner.name}</h1>
        <p className="one-line">{content.oneLine}</p>
      </div>
    </header>
  )
}
