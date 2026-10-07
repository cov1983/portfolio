# ADR 0004 — Pre-rendered root and Fallback Page; the World hydrates on top

Status: Accepted (2026-10-07)

## Context

The site is a 3D application, so the obvious shape is a single-page app that renders everything
client-side. But the root address is what people share, so link previews and search engines must
get real content without running a script; the spec's Title Screen responsiveness target cannot be
met by a client-rendered 3D bundle on a slow connection; and Visitors without 3D, keyboard or
script still need the full content.

## Decision

The root (Title Screen: Owner's name, one line, the Exhibit list, the Fallback link, Open Graph and
meta tags) and the Fallback Page (every Exhibit, Bio and Contact on one page with anchors) are
pre-rendered to plain HTML at build time. The World hydrates over the Title Screen afterwards. The
World's bundle is not needed for the Title Screen to be usable.

## Consequences

- The build needs a static pre-rendering step for two routes; the tool for it is chosen in the
  plan, within the stack of ADR 0003.
- Exhibit content files are the single source for the Title Screen list, the Exhibit Panels, the
  Banners and the Fallback Page, so the two renderings can never show different sets of Exhibits.
- Device and 3D-capability checks run after hydration and only add hints; the pre-rendered way
  into the World is never removed.
