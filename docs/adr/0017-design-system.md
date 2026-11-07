# ADR 0017 — Design system: Tailwind v4, copied shadcn/ui, Lucide, one dark token set, one font, CSS motion

Status: Accepted (2026-11-07) — ticket #100 (T0a), plan `docs/plan/increment-2.md` §2, §3 (this
ADR's stub), §6 (rows 1.1, 1.3, 16.3, the font measurement), §11 B2; the approved plan
([#100 comment 6705630377](https://github.com/cov1983/portfolio/issues/100#issuecomment-6705630377),
with the Owner's five approval amendments); Owner decisions on #100:
[6705559367](https://github.com/cov1983/portfolio/issues/100#issuecomment-6705559367) and
[6705619580](https://github.com/cov1983/portfolio/issues/100#issuecomment-6705619580) (the mark),
[6706618031](https://github.com/cov1983/portfolio/issues/100#issuecomment-6706618031) (the
decorative image, increment-1 AC-19.2 amended), [6706371929](https://github.com/cov1983/portfolio/issues/100#issuecomment-6706371929) (the font
pick, Manrope) and [6706451488](https://github.com/cov1983/portfolio/issues/100#issuecomment-6706451488)
(no preload); no Motion: [#59 comment 6662855247](https://github.com/cov1983/portfolio/issues/59#issuecomment-6662855247), item 2

## Context

The increment-2 spec's Implementation decisions › "Design system (T0, #67, D1–D8)" ask for one
redesign of every HTML surface on one token set: dark only, a navy base, one electric-blue accent
(D3, D5), exactly two effects (D6), one self-hosted variable grotesk (D4), the Owner's redrawn Puck
as mark and favicon (D8). It must not give up anything increment-1 proved: the pre-rendered,
hydration-identical Title Screen (`tests/build/index-html.test.ts` stays the proof), the CSP of
ADR 0012 (no `style` attribute in pre-rendered HTML, `font-src 'self'`, `img-src 'self'` with no
`data:`), reduced motion, and the perf budget. Production after T0a must look like one site
(plan §9, risk 3), so every increment-1 surface moves at once.

## Decision

**Tailwind CSS v4** through `@tailwindcss/vite` (build-time, `devDependencies` beside `vite`).
`src/site/site.css` is its entry and replaces increment-1's stylesheet rather than layering under
it: base rules and the components JSX cannot carry (Markdown prose, the dialog and its backdrop,
the World overlay) sit in `@layer base` and `@layer components`, so a utility on an element still
wins; the reduced-motion rule stays unlayered with `!important`, so no layer outranks it.
- **The scan root is `src/site/`** (`@import 'tailwindcss' source(none)` and `@source './'`).
  Left to itself Tailwind reads the whole repository, and `src/` alone turned words in the World's
  code (`blur`, `static`) into utilities. **A utility class written outside `src/site/` is
  silently dropped**: a later surface directory gets its own `@source` line (T3a's Discovery Form
  page, `src/discovery/` per plan §2, Module boundaries).
- **The scanner reads comments as well as code**: a word in a `src/site/` comment that names a
  utility generates it (T0a's Button comment first did, and emitted three literals). Comments in
  `src/site/` name no utility; `tokens.test`'s scan of the emitted CSS is the backstop.

**One token set**, `src/site/tokens.css`: one `@theme static` block that clears Tailwind's palette
(`--color-*: initial`), so a utility can only name a token, and holds every colour literal of the
HTML surfaces. **Opaque tokens are `#rrggbb`, translucent ones `#rrggbbaa`**;
`tests/e2e/look.spec.ts` reads only the opaque ones, from the file itself.

| token | value | why |
|---|---|---|
| `background` | `#0b1a2a` | the World's ink and canvas background: the site agrees with the World (D5) |
| `surface` | `#10233a` | the Panel, the hints, the overlay's controls |
| `foreground` | `#e8eef5` | 15.0:1 on the background |
| `muted-foreground` | `#9daec0` | 7.7:1 on the background, 7.0:1 on the surface |
| `primary` | `#168bff` | the mark's rim: the one accent; 5.2:1 on the background |
| `primary-foreground` | `#080f1d` | the mark's disc: the ink on a filled control (5.6:1; white on the accent is 3.4:1, below AA) |
| `border` | `#23405e` | |
| `overlay` | `#0b1a2ae6` | the background at 90 %, under the World overlay's caption and legend over the light ice |
| `backdrop` | `#0b1a2acc` | the background at 80 %, behind an open Exhibit Panel |

- **A translucent colour is a token of its own, never a `color-mix()` of a token in `site.css`**:
  Tailwind's optimizer (lightningcss) resolves the mix into a hex fallback outside the token layer.
- `:root { color-scheme: dark }`; there is no `prefers-color-scheme` variant (AC-1.1).
- **The rule is a gate** (`tests/build/tokens.test.ts`, AC-1.1): no colour literal (hex, a colour
  function, a CSS named colour) in the stylesheets the documents link outside a `--color-*`
  declaration; `transparent`, `currentcolor` and `inherit` are keywords, and so are `#0000` and
  `#00000000`, lightningcss's spelling of `transparent`. In `src/site/` no source but `tokens.css`
  holds a literal, with one declared exception, the mark's drawing (below), and no stylesheet but
  `tokens.css` declares a `--color-*` (a scoped override would pass the literal search through
  `var()`; ai-review round 1 on #121, finding 1); a component's code is
  searched with its comments dropped by TypeScript's parser and printer (an issue number such as
  `#100` is valid hex; a `//` in a string, JSX text or a template stays code), which is safe
  because the emitted-CSS scan catches any utility a comment generates.

**shadcn/ui components copied by hand** into `src/site/ui/` (no shadcn CLI, no runtime package):
`button.tsx` and `cn.ts` (clsx + tailwind-merge) in T0a. Changed from upstream: no `asChild` (it
needs Radix's Slot; `radix-ui` arrives with T3b); no focus-halo or elevation utilities (their
initial values are colour literals; focus is the site's own accent outline); no transition or
animation classes (AC-1.2); no opacity modifier on a colour utility (resolved into a hex literal;
hover brightens with a filter); the variants stay unexported (react-refresh; a `*.tsx` stays
outside the coverage ratchet). **Lucide React** is the one icon set; its icons are `aria-hidden`
by default, so a control's accessible name stays its text.

**One font**: one self-hosted, Latin-subset, variable woff2 (D4, AC-16.3), named by the token
`--font-sans`. Fontsource's stylesheets declare every subset (five woff2 for one family), so
`site.css` declares its own Latin `@font-face` (face, `font-display: swap` and range copied from
the package's Latin rule) with `url()` to the package file; Vite resolves the package path.
`tests/build/font.test.ts` holds exactly one woff2 under 100,000 B. Both candidates were measured
on the branch, each on its own preview: Geist Variable 29,400 B (67402b2), **Manrope Variable
24,836 B (15a1d2a), the Owner's pick**. **No preload** (the plan's rule: only if Title Screen
interactive improves and the download line holds); `make perf`, median of three on 15a1d2a, local
Chromium:

| line | without preload | with preload |
|---|---|---|
| Title Screen interactive | 224 ms (238 · 224 · 220) | 223 ms (224 · 222 · 223) |
| World playable | 2206 ms | 2187 ms |
| Download until playable | 2,027,930 B | 2,027,986 B |
| Longest task between marks | 83 ms | 76 ms |
| LCP (informational) | 191 ms | 226 ms |

**The mark and the favicon from one drawing** (D8, AC-1.3): `src/site/mark.svg`, the Owner's
redrawn Puck, is the only copy. The build derives `dist/favicon.svg` (its bytes) and
`dist/favicon.ico` (a 32 px PNG of it in a one-entry ICO) through `build/favicon.ts`; the dev
server serves the same pair; there is no `public/`. Its colours are literal, the declared exception
of the token rule, since a standalone favicon cannot read custom properties; `tokens.test` ties them
to the tokens (every stroke and gradient stop is `primary`, the disc's fill `primary-foreground`), so
a tuned token fails the build half until the drawing follows (ai-review round 1 on #121, finding 2).
The World's canvas background (`src/world/scene/world.css`) reads `var(--color-background)`; the
Banner's ink (`INK` in `src/world/scene/colours.ts`) is a World scene colour and keeps its own
`#0b1a2a`. The header mark beside
the name on the Title Screen and the Fallback Page is `<img src="/favicon.svg" alt="">`, so the icon
link and the mark name one emitted file:
- **A fixed path, not an asset import**: the hydration proof renders the App without the build's
  hashed asset names, so an imported URL would differ between the two renders.
- **Decorative, `alt=""`**: increment-1 AC-19.2 now reads "every image has an alt attribute:
  content images have alternative text, decorative images an empty one" (amended in 09f58b1).
- **`fetchPriority="low"` exists to keep React 19's server renderer from hoisting an image preload
  (`<link rel="preload" as="image">`) into the pre-rendered root, ahead of the Title Screen's
  `<main>`**; `index-html.test` pins it (the root opens with `<main class="title-screen">`). The
  mark still loads eagerly.

**Motion in CSS, no Motion dependency** (plan §2 and §11 B2; #59 comment 6662855247, item 2): the
headline reveal and the Title Screen–World crossfade (T0b) are CSS keyframes and transitions,
switched off by the existing `prefers-reduced-motion` rule. The spec's Motion sentences are amended
by T0b's first commit; this ADR cites the plan decision, not that amend.

## Consequences

- ADR 0012's "System fonts" consequence no longer holds (noted on 0012); `font-src 'self'`
  already allows the one woff2, so the policy is unchanged.
- A new colour is a token, never a literal; `tokens.test` fails the build half otherwise. A colour
  the Owner tunes is a hex edit in `tokens.css`, and `look.spec` follows it.
- A utility used outside `src/site/` renders unstyled without any error until its directory gets
  an `@source` line; a word in a `src/site/` comment can generate a utility.
- Radix primitives stay out of the root's chunks unless a surface there needs one (T3b brings
  `radix-ui` for the form's controls).
- The caption's fade-in (`caption-in`) is still on the site; whether it counts against AC-1.2's
  "exactly two effects" is T0b's to settle.
- The mark moves into T0b's sticky bar (#103) unchanged: same component, same file.
- The download until playable, read by `make perf` at each step of T0a: 1,990,241 B with Tailwind
  and the tokens (a96c9ed), 2,002,099 B with the Button, cva, tailwind-merge and two icons
  (e0a7813), 2,027,930 B with the Manrope woff2 (15a1d2a), 2,028,586 B with the mark (33825c4),
  of the 4,000,000 B line; the reading before T0a was not taken.
