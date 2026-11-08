// The mark (spec increment-2 AC-1.3, D8; Owner on #100, comments 6705559367 and 6705619580): the
// Owner's redrawn Puck beside the name on the Title Screen and the Fallback Page, until T0b (#103)
// moves it into the sticky bar. Decorative, so its alt is empty (increment-1 AC-19.2 as amended,
// #100 comment 6706618031): the name next to it is the text. Its src is /favicon.svg, the file the
// build derives from src/site/mark.svg (build/favicon.ts), so the icon link and the mark name one
// emitted file; a fixed path, not an asset import, because the hydration proof
// (tests/build/index-html.test.ts) renders without the build's hashed asset names.
// fetchPriority="low" exists to keep React 19's server renderer from hoisting an image preload
// (<link rel="preload" as="image">) into the pre-rendered root, ahead of the Title Screen's <main>;
// tests/build/index-html.test.ts pins it (the root opens with <main class="title-screen">). The
// mark still loads eagerly; a 48 px decorative image needs no preload.
export function Mark() {
  return (
    <img
      className="mark size-12 shrink-0"
      src="/favicon.svg"
      alt=""
      width={48}
      height={48}
      fetchPriority="low"
    />
  )
}
