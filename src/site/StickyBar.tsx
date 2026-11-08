import { Mark } from './Mark'

// The sticky bar (spec increment-2 US-3, AC-3.1–3.4; D7; plan §10 T0b): on the Title Screen,
// /exhibits and /start it stays at the top while the page scrolls, the mark on the left and, on the
// right, "Exhibits" (to the Fallback Page) and the filled "Start a project" (to /start), which is the
// current page on /start (AC-3.2). Plain links, so they navigate without script (AC-3.4), and
// anchors rather than the copied Button, which has no `asChild` (ADR 0017). The mark is the
// unchanged Mark (`alt=""`): on /exhibits and /start an anchor wraps it and leads to the Title
// Screen, named by visually hidden text; on `/` it is plain (Owner, #103 comment 6723215733). On
// `/` the bar sits in the Title Screen's layer, so it leaves with it: out of sight, inert and out of
// the accessibility tree in the World (AC-3.3). A `div`, not a `header`: the pages keep their own
// header, and two banner landmarks would be one too many; the nav is its landmark, named "Site".
type Props = {
  /** The mark leads to the Title Screen (on /exhibits and /start, not on `/` itself). */
  homeLink: boolean
  /** The page the bar marks as current: /start's "Start a project". */
  current?: 'start'
}

export function StickyBar({ homeLink, current }: Props) {
  return (
    <div className="sticky-bar">
      {homeLink ? (
        <a href="/" className="bar-home">
          <Mark />
          <span className="sr-only">Title Screen</span>
        </a>
      ) : (
        <Mark />
      )}
      <nav aria-label="Site">
        <ul>
          <li>
            <a href="/exhibits">Exhibits</a>
          </li>
          <li>
            <a
              href="/start"
              className="bar-start"
              aria-current={current === 'start' ? 'page' : undefined}
            >
              Start a project
            </a>
          </li>
        </ul>
      </nav>
    </div>
  )
}
