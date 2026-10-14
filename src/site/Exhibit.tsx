import type { Exhibit as ExhibitContent } from '../content/types.ts'
import { Picture } from './Picture'

// One Exhibit in full (spec: Exhibit Panel, AC-16.1; Fallback Page, AC-19.1): title, hook,
// summary, role, tech, year, links, images with their alternative text, the video with its poster
// and controls and no autoplay (AC-17.2), "what I'd do differently"; never the visibility. The
// Markdown fields arrive as HTML the build rendered with raw HTML escaped (ADR 0011). Under its
// id on the Fallback Page; the Exhibit Panel (src/site/ExhibitPanel.tsx) renders the same
// component and names its dialog by the heading (`headingId`, absent on the Fallback Page).
type Props = { exhibit: ExhibitContent; headingId?: string }

export function Exhibit({ exhibit, headingId }: Props) {
  return (
    <article id={exhibit.id} className="exhibit">
      <h2 id={headingId}>{exhibit.title}</h2>
      <p className="hook">{exhibit.hook}</p>
      <div className="prose" dangerouslySetInnerHTML={{ __html: exhibit.summaryHtml }} />
      <dl className="facts">
        <dt>Role</dt>
        <dd>{exhibit.role}</dd>
        <dt>Tech</dt>
        <dd>
          <ul className="tech">
            {exhibit.tech.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </dd>
        <dt>Year</dt>
        <dd>{exhibit.year}</dd>
        {exhibit.links.length > 0 && (
          <>
            <dt>Links</dt>
            <dd>
              <ul className="links">
                {exhibit.links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
      {exhibit.images.map((image) => (
        <Picture key={image.fallback} image={image} />
      ))}
      {exhibit.video !== undefined && (
        <video
          controls
          preload="none"
          poster={exhibit.video.poster.fallback}
          width={exhibit.video.poster.width}
          height={exhibit.video.poster.height}
        >
          <source src={exhibit.video.src} type={exhibit.video.type} />
        </video>
      )}
      <h3>What I’d do differently</h3>
      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: exhibit.whatIdDoDifferentlyHtml }}
      />
    </article>
  )
}
