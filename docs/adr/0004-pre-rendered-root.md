# ADR 0004 — The root and the Fallback Page are pre-rendered HTML; the World hydrates on top

Status: Accepted (2026-10-07)

The site is a 3D application, so the obvious shape is a single-page app that renders everything
client-side. We instead pre-render the root address (Title Screen: Owner's name, one line, the
Exhibit list, the Fallback link, Open Graph and meta tags) and the Fallback Page (every Exhibit,
Bio and Contact on one page with anchors) to plain HTML at build time, and let the World hydrate
over the Title Screen afterwards. Why: the root is what people share, so link previews and search
engines must get real content without running a script; the Title Screen must be interactive
within 2 s on a throttled 10 Mbit/s connection, which a client-rendered 3D bundle cannot meet; and
Visitors without 3D, keyboard or script still get the full content from the same source files.

## Consequences

- The build needs a static pre-rendering step for two routes; the toolchain choice for it is made
  in the plan, within the stack of ADR 0003.
- Exhibit content files are the single source for the Title Screen list, the Exhibit Panels, the
  Zone banners and the Fallback Page, so the two renderings can never show different sets of
  Exhibits.
- Device and WebGL checks run after hydration and only add hints; the pre-rendered Start action
  is never removed.
