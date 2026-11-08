import type { Content } from '../content/types.ts'

// The hero (spec increment-2 US-2, AC-1.2, AC-2.2; D6; plan §2): the Title Screen's headline, the
// Owner's name and the one line, with the site's two effects. The first is the headline reveal, a
// CSS keyframe animation whose resting state is the visible headline, so a page without script
// shows it (AC-2.2); reduced motion switches it off (site.css, AC-2.4). The second is the static
// blue edge glow, a CSS gradient on this element (site.css): no image, no mask, no element of its
// own. The grid backdrop of AC-2.1 is handed off (Owner, #103 comment 6728114096): every backdrop
// image on the first viewport measured slow runs before the World preload.
type Props = { content: Content }

export function Hero({ content }: Props) {
  return (
    <header className="hero">
      <div className="headline">
        <h1>{content.owner.name}</h1>
        <p className="one-line">{content.oneLine}</p>
      </div>
    </header>
  )
}
