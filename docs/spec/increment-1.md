# Spec: increment-1            Status: approved   Owner: Thomas (@cov1983)

Written 2026-10-08 by `/to-spec` from issue #3 (grilling outcome), `GLOSSARY.md` and ADRs 0003–0005.
No new interview was held. Terms in capitals are defined in `GLOSSARY.md`. The decisions the sources
did not state and the open questions the draft raised were resolved by the Owner in the review of
PR #6 on 2026-10-08 and are folded into the body below; *Open questions* is empty. Status stays
`draft` until the `spec: approve increment-1` commit.

## Problem & goal

### Problem statement

Thomas's work (software, embedded and homelab projects, and the way he builds with AI agents) has no
public home. A classic portfolio page would show the results but nothing of the craft. Engineers and
technically literate hiring managers, the primary Visitors, decide in a minute or two whether a
candidate is interesting; a static list of links does not earn that minute. At the same time, the
address they receive will be opened on phones, in chat link previews, by crawlers and by people who
use assistive technology, and none of those must hit a wall.

### Solution

A browser-based 3D World in which the Visitor steers an ice-hockey Puck across a Hub, down a Path
and into a Zone, where driving the Puck into the Goal opens the Exhibit. The experience itself is the
first Exhibit: the increment ships one Exhibit, "this portfolio and the AI-assisted workflow behind
it". Around the World sit three plain HTML surfaces that need no 3D and no script to be useful: the
pre-rendered Title Screen at the root address, the Exhibit Panel that also opens straight from the
Title Screen's Exhibit list, and the Fallback Page with every Exhibit, the Bio and the Contact.
Nothing gates content: the World is the fun way in, never the only way in.

increment-1 is the smallest shippable slice that proves the whole shape: Title Screen, Hub, one Path,
one Zone with its Goal and Banner, the Puck with Direct Drive, Follow Camera and Reset, one Exhibit,
the Bio, the Contact, two Announcer captions, the Fallback Page, and the Exhibit Panel opened from
both the Goal and the Title Screen.

## Users & context

- **Visitor with keyboard and a 3D-capable browser** (the primary case): a desktop or laptop, often
  integrated graphics, a current browser, arriving from a shared link. Wants to be steering within
  seconds and to find the Exhibit without instructions.
- **Visitor on a phone or tablet**: coarse pointer, no keyboard. Touch steering is not in this
  increment. Must still see who this is, reach every Exhibit, the Bio and the Contact, and be told
  plainly that the World needs a keyboard for now.
- **Visitor using assistive technology, or with script or WebGL unavailable**: served by the
  pre-rendered Title Screen and the Fallback Page, both plain HTML.
- **Visitor with `prefers-reduced-motion`**: gets the World without camera easing, shake or
  celebration animation; the Puck still moves.
- **Link previews and crawlers**: fetch the root address without running script and must get the
  Owner's name, a description and a preview image.
- **The Owner**: writes and publishes all content as files in the public repository; nobody else
  publishes. Builds on a solo, about-4-hours-a-week budget, so every requirement here must earn its
  place.

The World is one continuous space: the Hub and the Zone are each a Rink with boards, joined by a
boarded Path, with no separate loading between them. The site is static: no backend, no storage, no
analytics, no third-party scripts or embeds.

## User stories & acceptance criteria

Acceptance criteria are Given / When / Then. Reference numbers from ADR 0005 appear in brackets as
tolerances for tests, not as requirements in themselves: the feel in words is the requirement.

### Title Screen

- **US-1** As a Visitor, I want the root address to show who this is and how to get in before any
  3D has loaded, so that a slow connection does not cost me the first impression.
  - AC-1.1 Given a fresh visit to the root address on the throttled 10 Mbit/s profile, When the
    page loads, Then the Title Screen (Owner's name, one line, the Contact line, the way into the
    World, the Exhibit list and the Fallback Page link) is rendered from pre-rendered HTML and is
    interactive within 2 s, without waiting for the World bundle.
  - AC-1.2 Given script is disabled, When the root address loads, Then the same Title Screen content
    is visible and the Fallback Page link, the two Contact links and each Exhibit list entry are
    working links.
  - AC-1.3 Given the Title Screen is shown, When the Visitor presses Enter or Space, or activates the
    way-in control with a pointer, Then entry into the World begins.
- **US-2** As a Visitor, I want to open any Exhibit straight from the Title Screen, so that I can
  read about the work without playing.
  - AC-2.1 Given the Title Screen is shown and the World bundle has not finished loading, When the
    Visitor picks an Exhibit from the list, Then its Exhibit Panel opens over the Title Screen with
    the full content of that Exhibit.
  - AC-2.2 Given an Exhibit Panel is open over the Title Screen, When the Visitor presses Escape or
    activates the Panel's close control, Then the Panel closes, the Title Screen is shown again and
    keyboard focus returns to the list entry that opened the Panel.
  - AC-2.3 Given script is disabled, When the Visitor activates an Exhibit list entry, Then the
    browser navigates to that Exhibit's anchor on the Fallback Page.
- **US-3** As a Visitor who shares the address, I want link previews to show something meaningful,
  so that the people I send it to open it.
  - AC-3.1 Given the root address is fetched without executing script, When the response is parsed,
    Then it contains a title with the Owner's name, a description and a preview image in Open Graph
    and standard meta tags, and the image is served from the site's own origin.

### Entering the World

- **US-4** As a Visitor, I want the World to be ready quickly after the Title Screen, so that pressing
  Enter does not lead to a wait.
  - AC-4.1 Given a fresh visit on the throttled 10 Mbit/s profile, When the Visitor enters the World
    as soon as the Title Screen allows, Then the World is playable (a steering key moves the Puck and
    the result is rendered) within 5 s of navigation start.
  - AC-4.2 Given the World bundle has not finished loading, When the Visitor starts entry, Then the
    way-in control shows that loading is in progress, and the World appears as soon as it is playable
    without a second key press.
  - AC-4.3 Given everything needed until the World is playable, When the transferred bytes are
    summed, Then they total at most 4 MB compressed, Exhibit images and video excluded (ADR 0003).
- **US-5** As a Visitor, I want to start in a clear place with a clear hint of what to do, so that I
  do not need instructions.
  - AC-5.1 Given the World becomes playable, When the first frame is shown, Then the Puck rests at
    the centre of the Hub, the Follow Camera frames it, and the Hub's Announcer caption (the welcome)
    is shown as text.
  - AC-5.2 Given the Puck rests at the centre of the Hub, When the first frame is rendered, Then the
    single Path opening in the Hub's boards is inside that frame.
- **US-6** As a Visitor, I want to get back to the Title Screen and into the World again without
  losing my place, so that I can re-read the list or leave politely.
  - AC-6.1 Given the Visitor is in the World, When they press Escape, Then the Title Screen is shown,
    the World is paused and the Puck keeps its position and velocity.
  - AC-6.2 Given the Title Screen is shown over a paused World, When the Visitor presses Enter or
    Space, Then the World resumes where it was; no Reset happens.

### Steering the Puck (Direct Drive)

- **US-7** As a Visitor, I want to steer the Puck with the arrow keys or WASD, so that I can move
  without a mouse.
  - AC-7.1 Given the World is playable, When the Visitor holds an arrow key or the matching W/A/S/D
    key, Then the Puck accelerates in that direction on the ice, and the direction is the same for
    the arrow and the letter.
  - AC-7.2 Given any keyboard layout, When the Visitor presses the physical keys in the W/A/S/D
    positions, Then they steer, because keys are read by physical position, not by the character
    they produce.
  - AC-7.3 Given two perpendicular steering keys are held, When the Puck accelerates, Then it moves
    diagonally with no more acceleration than a single key gives.
  - AC-7.4 Given the Follow Camera's fixed yaw, When the Visitor presses "up", Then the Puck
    accelerates away from the camera, towards the far end of the Hub as first seen; "up" is always
    the same direction on the ice (ADR 0005).
- **US-8** As a Visitor, I want the Puck to feel like a puck on ice, so that steering is a pleasure
  and stopping at the Goal is possible on purpose.
  - AC-8.1 Given the Puck is at rest at the centre of the Hub, When a steering key is held, Then the
    Puck reaches its top speed at about the Hub's blue line [reference: about 0.6 s, 12 m/s].
  - AC-8.2 Given the Puck travels at top speed, When all steering keys are released, Then it glides
    a little less than half the Hub's length before coming to rest [reference: about 19 m in about
    4 s on a 40 m Hub].
  - AC-8.3 Given the Puck is moving, When a steering key is held, Then its speed never exceeds the
    top speed.
  - AC-8.4 Given the Puck is moving, When nothing is pressed, Then it never rotates visibly about its
    vertical axis and never tips.
- **US-9** As a Visitor, I want the Puck to stay on the ice, so that I cannot get lost or stuck
  outside the World.
  - AC-9.1 Given the Puck travels at top speed towards any board of the Hub, the Path or the Zone,
    When it reaches the board, Then it rebounds and remains inside the Rink or Path [reference:
    board restitution 0.5].
  - AC-9.2 Given any sequence of inputs for any length of time, When the Puck's position is
    sampled, Then it is always inside the Hub, the Path or the Zone.
- **US-10** As a Visitor, I want to travel from the Hub to the Zone without any break, so that the
  World feels like one place.
  - AC-10.1 Given the Puck crosses from the Hub into the Path and from the Path into the Zone, When
    the crossing happens, Then no loading indication appears and the Puck keeps its velocity
    (frame rate is AC-23.1).

### Follow Camera

- **US-11** As a Visitor, I want the camera to keep the Puck and its surroundings in view, so that I
  always know where I am and where the boards are.
  - AC-11.1 Given the Puck moves, When the Follow Camera updates, Then it trails the Puck's position
    with easing and keeps a fixed world yaw; it never swings behind the direction of travel
    (ADR 0005).
  - AC-11.2 Given the Puck is anywhere in the World, When a frame is rendered, Then the Puck is
    inside the frame.
  - AC-11.3 Given `prefers-reduced-motion` is set, When the Follow Camera updates, Then it tracks the
    Puck without easing or lag.

### Reset

- **US-12** As a Visitor, I want to return the Puck to the start at any moment, so that getting
  stuck in a corner costs nothing.
  - AC-12.1 Given the Visitor is in the World and no Exhibit Panel is open, When they press R, Then
    the Puck is at rest at the centre of the Hub and the Follow Camera frames it immediately.
  - AC-12.2 Given the World's overlay shows a Reset control, When the Visitor activates it with a
    pointer, Then the same Reset happens and the steering keys still work afterwards without
    clicking back into the World.
  - AC-12.3 Given an Exhibit Panel is open, When the Visitor presses R, Then nothing happens in the
    World; the key goes to the Panel.

### Reaching the Exhibit

- **US-13** As a Visitor, I want to see what a Zone is about before I reach its Goal, so that the
  World tells me where I am.
  - AC-13.1 Given the World is playable, When the Puck first enters the Zone, Then one short text
    caption for the Zone is shown.
  - AC-13.2 Given the Zone is built from the Exhibit's content file, When the Banner over the Goal is
    inspected, Then the Banner's text equals the Exhibit's title and hook from the content file.
- **US-14** As a Visitor, I want driving the Puck into the Goal to open the Exhibit, so that the
  hockey move is the way to the content.
  - AC-14.1 Given the Puck is in the Zone, When it crosses the goal line into the net, Then the World
    pauses and the Exhibit Panel for that Zone's Exhibit opens.
  - AC-14.2 Given the Exhibit Panel was opened from the Goal and is then closed, When the World
    resumes, Then the Puck is still in the Goal and the Panel does not reopen until the Puck has left
    the Goal and entered it again.
  - AC-14.3 Given the Puck brushes the outside of the net or the posts, When contact happens, Then
    the Panel does not open.
- **US-15** As a Visitor, I want nothing in the World to lock content away, so that a missed shot or
  a weak device never costs me information.
  - AC-15.1 Given any state of the World, When the Visitor presses Escape until the Title Screen
    shows and picks the Exhibit from the Title Screen list, Then the Exhibit Panel opens with the
    full content.

### Exhibit Panel

- **US-16** As a Visitor, I want the Exhibit Panel to be a readable page, not a game overlay, so
  that I can take the content in at my own pace.
  - AC-16.1 Given an Exhibit Panel is open, When it is inspected, Then it shows every field of the
    Exhibit schema except visibility (the field list is under Content decisions), as HTML text and
    media.
  - AC-16.2 Given an Exhibit Panel is open, When the Visitor scrolls, Then long content scrolls
    inside the Panel and the Panel is readable at viewport widths from 320 px upwards.
  - AC-16.3 Given an Exhibit Panel is open, When the Visitor presses Tab repeatedly, Then focus
    cycles through the Panel's controls and links and never reaches the World or the Title Screen
    behind it.
  - AC-16.4 Given an Exhibit Panel is open over the World, When any key is pressed, Then the Puck
    does not move and the World stays paused.
  - AC-16.5 Given an Exhibit Panel is open over the World, When the Visitor presses Escape or
    activates the close control, Then the Panel closes, the World resumes and keyboard focus is back
    in the World so that steering works at once.
- **US-17** As a Visitor, I want Exhibit media to cost me nothing until I ask for it, so that the
  World stays fast.
  - AC-17.1 Given no Exhibit Panel has been opened yet, When all network requests since navigation
    start are listed, Then none of them is an Exhibit image or video.
  - AC-17.2 Given an Exhibit has a video, When its Panel opens, Then the video shows a poster image
    and controls and does not play until the Visitor starts it.
  - AC-17.3 Given an Exhibit Panel opens, When its images load, Then they are served from the site's
    own origin at a size appropriate to the viewport (optimised at build).

### Announcer

- **US-18** As a Visitor, I want a light touch of storytelling, so that the World has a voice
  without a tutorial.
  - AC-18.1 Given the World, When all Announcer captions are counted, Then there are exactly two in
    increment-1: the welcome on the Hub and one at the Zone; each is a single sentence of text in the
    style of a rink public-address announcer.
  - AC-18.2 Given a caption is shown, When it is inspected, Then it is HTML text in an overlay that
    assistive technology can read, not text rendered in 3D.
  - AC-18.3 Given `prefers-reduced-motion` is set, When a caption appears or disappears, Then it does
    so without animation.

### Fallback Page

- **US-19** As a Visitor without 3D, keyboard or script, or with assistive technology, I want
  everything the World holds as a plain page, so that I miss nothing.
  - AC-19.1 Given the Fallback Page is loaded with script disabled, When it is read, Then it shows
    every Exhibit in full (the same fields as the Panel), the Bio and the Contact, each Exhibit under
    its own anchor, with a link back to the Title Screen.
  - AC-19.2 Given the Fallback Page is loaded with a screen reader, When it is navigated by headings
    and landmarks, Then every Exhibit, the Bio and the Contact are reachable, and every image has
    alternative text.
  - AC-19.3 Given the Fallback Page and the Title Screen list are both rendered, When their sets of
    Exhibits are compared, Then they are identical, because both render from the same content files.
- **US-20** As a Visitor, I want to reach the Owner, so that I can follow up.
  - AC-20.1 Given the Contact is shown, When the Visitor activates the e-mail link, Then their mail
    client opens with the Owner's address, and the address does not appear as a plain `mailto:` text
    in the delivered HTML source.
  - AC-20.2 Given the Contact is shown, When the Visitor activates the GitHub link, Then it opens the
    Owner's GitHub profile in a new tab.
  - AC-20.3 Given the Title Screen and the Fallback Page are rendered, When each is inspected, Then
    the Contact (GitHub link and obfuscated e-mail link) appears on both, as one line on the Title
    Screen, and the Bio appears on the Fallback Page only.

### Devices and capability

- **US-21** As a Visitor on a phone or tablet, I want to be told honestly what works, so that I do
  not fight a keyboard-only World on a touch screen.
  - AC-21.1 Given a coarse pointer or no keyboard is detected after hydration, When the Title Screen
    is shown, Then a hint says the World needs a keyboard for now and the Fallback Page link is
    placed first; the way into the World stays visible and functional.
  - AC-21.2 Given the Title Screen before hydration, When it is inspected, Then no hint is present
    and the way into the World is present; detection only ever adds.
- **US-22** As a Visitor whose browser cannot render the World, I want a readable explanation and a
  way on, so that I never see a blank page.
  - AC-22.1 Given WebGL is unavailable, When the Title Screen is shown after hydration, Then a hint
    says the World cannot run here and the Fallback Page link is placed first.
  - AC-22.2 Given the World fails to start after the Visitor entered it (WebGL lost, bundle failed,
    physics failed to initialise), When the failure is detected, Then a readable message with the
    Fallback Page link replaces the World and the Title Screen remains reachable.
- **US-23** As a Visitor on a laptop with integrated graphics, I want the World to run smoothly, so
  that steering feels right.
  - AC-23.1 Given the Owner's reference laptop, named in the plan (intended class: Intel Iris Xe
    integrated graphics), and a current browser, When the Owner drives across the whole World for
    one minute, Then the frame rate stays at or above 50 fps and the measurement is recorded in the
    PR.
- **US-24** As a Visitor on any current browser, I want the site to work, so that the choice of
  browser is not a barrier.
  - AC-24.1 Given Chromium, Firefox and WebKit at the versions Playwright ships, When the automated
    suite runs, Then every automated acceptance criterion holds in all three.
  - AC-24.2 Given the current browsers available to the Owner, When the Owner exercises the Title
    Screen, the World and the Fallback Page once per increment, Then they work and the result is
    recorded in the PR; Safari is covered by Playwright WebKit until a Mac is available.

### Reduced motion

- **US-25** As a Visitor with `prefers-reduced-motion`, I want a calmer World, so that I can use it
  comfortably.
  - AC-25.1 Given `prefers-reduced-motion` is set, When any event in increment-1 happens (Goal,
    Reset, caption, Panel open and close), Then there is no screen shake, no scoring celebration and
    no caption animation; the Puck still moves under Direct Drive and the Follow Camera still tracks
    it (AC-11.3).

### Owner publishing content

- **US-26** As the Owner, I want to write an Exhibit as one Markdown file with front matter, so
  that publishing is a commit.
  - AC-26.1 Given a content file with front matter fields title, hook, summary, role, tech, year,
    links, images (1–3, each with alternative text), optional video (with poster), "what I'd do
    differently" and visibility, When the site is built, Then the Title Screen list, the Exhibit
    Panel, the Banner and the Fallback Page all render that Exhibit from that one file.
  - AC-26.2 Given a content file is missing a required field or has an unknown visibility value,
    When the site is built, Then the build fails and names the file and the field.
  - AC-26.3 Given a content file references an image, video or internal link that does not exist,
    When the site is built, Then the build fails and names the file and the reference.
  - AC-26.4 Given the Bio is a Markdown file, When the site is built, Then the Fallback Page renders
    it as the Bio.
- **US-27** As the Owner, I want media to be optimised at build, so that I can commit originals and
  never hand-tune sizes.
  - AC-27.1 Given an Exhibit image committed at original size, When the site is built, Then the
    delivered page offers it in viewport-appropriate sizes as AVIF or WebP with a fallback, and the
    original file is not what the Panel loads by default.

### Privacy and trust

- **US-28** As a Visitor, I want the site to do nothing behind my back, so that visiting a portfolio
  costs me no data.
  - AC-28.1 Given a full visit (Title Screen, World, Goal, Panel, Fallback Page), When all network
    requests are listed, Then every request goes to the site's own origin; no third-party script,
    font, embed or beacon is loaded.
  - AC-28.2 Given a full visit, When cookies, local storage, session storage and IndexedDB are
    inspected afterwards, Then they are empty of anything the site wrote.
  - AC-28.3 Given the site, When any audio is looked for, Then there is none in increment-1.

## Non-functional requirements

**Performance** (acceptance criteria and a CI performance budget wired in Phase 0b)

| measure | target | where measured |
|---|---|---|
| Title Screen interactive | ≤ 2 s | Lighthouse, throttled 10 Mbit/s profile, CI |
| World playable | ≤ 5 s from navigation start | same profile, CI; "playable" per AC-4.1 |
| Initial download until World playable | ≤ 4 MB compressed, Exhibit media excluded; plan aims at about 2.5 MB (spike: about 1.2 MB) | build output, CI |
| Frame rate in the World | ≥ 50 fps sustained | Owner on the reference laptop named in the plan (Iris Xe class), per ticket |

If the 4 MB ceiling and the 5 s target ever conflict, the 5 s target wins (issue #3). Frame rate
is Owner-measured because CI has no GPU. No client-side performance metrics are collected in
increment-1: CI's performance budget is the measurement, and a later spec decides client-side
metrics (this resolves issue #3 Rule 1 against Rule 4, "nothing counted until a spec says
otherwise").

**Availability.** Static files on a static host; no backend. An uptime check exists once the site is
hosted (constitution principle 5 as reworded in issue #3). No numeric availability target in
increment-1.

**Security.** No backend, no form, no persistence, no third-party code at runtime. All assets are
served from the site's own origin. The e-mail address is obfuscated against naive scraping while
staying usable (AC-20.1). Dependencies and CI actions are pinned (constitution principle 6);
response headers are a plan decision.

**Accessibility.** The Title Screen, the Exhibit Panel, the World's HTML overlay (captions, Reset
control, hints) and the Fallback Page are plain HTML: keyboard operable, focus visible, focus
trapped in an open Panel and restored on close, images with alternative text, captions readable by
assistive technology. The 3D canvas itself is not made accessible; every piece of content it leads
to is reachable without it. `prefers-reduced-motion` is honoured as in US-11, US-18 and US-25.
Conformance level: WCAG 2.2 AA, scoped to the HTML surfaces named above and checked with axe in
test seam 1.

**Internationalisation.** English only, decided in grilling round 1; no language switch (bilingual
content is a later increment).

**Browsers.** Current and previous major versions of Chrome, Firefox, Safari and Edge, desktop
(issue #3 names the browsers; desktop follows from the keyboard-only World). The site must load
and the Fallback Page must work on mobile browsers. Automated coverage is Chromium, Firefox and
WebKit through Playwright (AC-24.1); the Owner covers the rest once per increment (AC-24.2).

## Data & privacy classification

| data | classification | where stored | retention | who may see |
|---|---|---|---|---|
| Exhibit content, Bio, images, video, 3D assets | public, the Owner's deliberately published material; all rights reserved (LICENSE ticket) | the public repository and the built site | as long as published | everyone |
| Contact: the Owner's e-mail address and GitHub profile URL | public by the Owner's choice; e-mail obfuscated against scraping | repository and built site | as long as published | everyone |
| Visitor data | none collected, stored, counted or sent anywhere | nowhere | n/a | n/a |
| Client-side logs | none leave the browser in increment-1 | nowhere | n/a | n/a |

The increment-1 Exhibit has Visibility `personal`. `employer-generic` Exhibits (described only as
problem, architecture, role and tech, committed only after the employer's written OK referenced in
the PR) are a later increment; the schema accepts the value now so that the rule is enforced from
the start. Nothing from employer systems or clients beyond a public profile enters the repository,
prompts or any AI tool context (constitution principle 8).

## Implementation decisions

Decisions below come from the sources named at the top. No file paths or code, so they stay true
when the plan moves things.

**Architecture (ADR 0003, 0004)**

- TypeScript (strict), three.js through React Three Fiber with drei, Rapier for physics, Vite,
  Vitest, Playwright, ESLint, Prettier, pnpm. Toolchain configuration is Phase 0b.
- The root address and the Fallback Page are pre-rendered to plain HTML at build time. The World
  hydrates over the Title Screen afterwards. The pre-rendering mechanism is chosen in the plan.
- The Title Screen and the Exhibit Panel do not depend on the World bundle: a Panel opens from the
  list before the World has loaded (AC-2.1). The World bundle starts loading in the background as
  soon as the Title Screen is interactive, without waiting for the Visitor to press Enter, so that
  the 2 s and 5 s targets hold together. Exception: when a coarse pointer is detected after
  hydration (US-21) no preload happens; the bundle loads only if the Visitor enters the World.
- Exhibit list entries on the Title Screen are links to the Exhibit's Fallback Page anchor; with
  script, activation opens the Panel instead (progressive enhancement, AC-1.2 and AC-2.3). There
  are no deep links to an Exhibit Panel in increment-1; the Fallback Page anchors are the shareable
  per-Exhibit addresses.
- Device, keyboard and 3D-capability checks run after hydration and only add hints and reorder the
  Fallback link; they never remove or disable the way into the World. The keyboard hint reads "the
  World needs a keyboard for now" (issue #3); the WebGL-unavailable hint has its own wording
  (AC-22.1). A failure after entry shows a readable message with the Fallback Page link (AC-22.2).
- "World playable" for the budget is marked when the first frame after physics initialisation has
  rendered and input is wired; the plan picks the instrument.
- The World's model (Rinks, boards, Puck, Goal, Announcer places, pause, Reset, and the Follow
  Camera's target position and frame as a function of the Puck's position and the fixed yaw) is
  separable from rendering and can be stepped with inputs and a fixed timestep without a browser.
  This is what makes test seam 2 possible, lets AC-5.2, AC-11.1 and AC-11.2 be tested there, and is
  what ADR 0005 already relied on.
- The World is one continuous space (Hub, Path, Zone) with no loading between its parts, built so
  that further Zones can be lazy-loaded in later increments. increment-1 ships everything in the
  initial World download.

**World and Puck (ADR 0005, issue #3)**

- Dimensions: the Hub is 40 m by 20 m, the prototype's Rink, so ADR 0005's blue-line and half-Rink
  statements hold without re-measurement; the Zone is 30 m by 20 m; the Path is about 15 m long and
  6 m wide. The plan may adjust the Zone and the Path, the Hub only with a feel re-check.
- Every Rink and the Path have boards; the Puck's collision shape can never leave them.
- Direct Drive is world-relative, equal to camera-relative under the fixed-yaw Follow Camera.
  Steering keys apply acceleration; release lets the Puck glide; a speed cap holds. Puck rotations
  are locked. The feel is the Standard preset of ADR 0005 in words; the reference numbers there
  (μ 0.1, linear damping 0.4 /s, acceleration 24 m/s², cap 12 m/s, board restitution 0.5, mass 1)
  are the starting point and may move as long as AC-8.1 and AC-8.2 hold on the Hub's actual size.
  ADR 0005's Decision keeps the values "unchanged" and its Consequence lets them move against the
  Hub's actual size; with the 40 m Hub above both agree and the values stay as they are. Diagonal
  input is normalised (AC-7.3).
- The Follow Camera keeps a fixed world yaw and trails the Puck's position with easing; easing is
  removed under `prefers-reduced-motion`. On Reset the camera snaps to the Puck instead of easing
  across the World (AC-12.1).
- The Goal is a sensor volume inside the net behind the goal line; entering it pauses the World and
  opens the Exhibit Panel. Posts and net outside are solid. The Goal re-arms only after the Puck
  has left the Goal volume, so closing a Panel does not reopen it (AC-14.2).
- Reset places the Puck at rest at the centre of the Hub. It is both the R key and a control in the
  World's HTML overlay.
- The World's HTML overlay in increment-1 holds exactly: the current caption, the Reset control and
  a one-line key legend (arrows or WASD, R, Esc). Nothing else.
- Focus handling: entering the World gives it keyboard focus; activating an overlay control with a
  pointer returns focus to the World; opening a Panel moves focus into it; closing restores focus
  to the opener (list entry or World). The Exhibit Panel is readable from 320 px viewport width
  (AC-16.2).
- Pausing the World stops the physics step and input; the Puck's state is preserved exactly and
  resumes unchanged. The World is paused whenever an HTML overlay owns the keyboard: an open
  Exhibit Panel, or the Title Screen shown with Escape (AC-6.1; issue #3 says only "without
  resetting the Puck", pausing follows from this rule).
- Keys: arrows and W/A/S/D steer (read by physical key position); R Reset; Escape closes an open
  Panel, otherwise shows the Title Screen without Reset; Enter or Space enters or resumes the World
  from the Title Screen. No mouse is needed in the World; the mouse works in every HTML overlay.
- Storytelling is Announcer captions only: text, one short sentence per place, two places in
  increment-1 (Hub welcome, Zone). Captions are HTML overlay text; each appears once per place per
  page load and disappears after about 5 s or when a Panel opens.

**Content (issue #3, ADR 0004)**

- One Markdown file with YAML front matter per Exhibit; the Bio is a Markdown file. Front matter
  fields: a stable identifier (used for the Fallback anchor and the Zone), title, hook, summary,
  role, tech, year, links, images (1–3, each with alternative text), optional short video (with a
  poster image), "what I'd do differently", visibility (`personal` | `employer-generic`). The
  identifier, alternative text and poster are additions to issue #3's list, forced by AC-19.2 and
  AC-17.2. The schema accepts `employer-generic` now although no such Exhibit ships in increment-1,
  so the rule in issue #3 is enforced from the first build. The schema is validated at build; a
  missing field or a broken internal reference (image, video, internal link) fails the build.
  External URLs are checked by a scheduled, non-blocking job, so the build does not depend on the
  network.
- A small site content file holds the Title Screen's one line (one sentence written by the Owner,
  not the Hook of any Exhibit), the Contact and the two Announcer captions. The social preview
  image for the root address is one image provided by the Owner; it falls back to the first image
  of Exhibit-1.
- The Exhibit files are the single source for the Title Screen list, the Exhibit Panels, the
  Banners and the Fallback Page.
- Exhibit images and video are self-hosted in the repository, optimised at build, and load only
  with their Exhibit Panel (poster image, no autoplay). They are outside the initial download
  budget.
- Background content is the Bio only; the CV is a later increment. The Bio appears on the Fallback
  Page only; a Bio place in the World is a later increment.
- Contact is the GitHub profile link and an obfuscated e-mail link. It appears on the Title Screen
  as one line and on the Fallback Page. The e-mail link is a character-reference-encoded `mailto:`,
  which works without script and defeats naive scraping; stronger schemes only if scraping becomes
  a problem. There is no LinkedIn link.
- Fonts, if any beyond system fonts, are self-hosted (AC-28.1).

## Testing decisions

**What makes a good test here.** A test observes what a Visitor or the build can observe: rendered
HTML, focus, network requests, the Puck's position and speed over time, the build's exit status and
message. No test reads component state, three.js internals or Rapier handles. One assertion concept
per test, behaviour-level names using the glossary's terms, no sleeps: browser tests wait on a
condition, headless World tests advance a known number of fixed steps (CLAUDE.md conventions).

**Seams.** Two, as high as the stack allows. There is no application code yet, so there is no prior
art inside this repository; the prior art for the second seam is ADR 0005's reproduction of the
Puck feel in Rapier under Node.

1. **The build and its output in a browser.** The site is built as for production; Playwright
   drives the built output in headless Chromium, Firefox and WebKit. This seam covers the Title
   Screen, the Exhibit Panel from the list, the Fallback Page, script-disabled behaviour, focus,
   reduced motion and coarse-pointer emulation, meta tags, the request log (no third-party
   requests, no Exhibit media before a Panel), entry into the World and the Escape round trip. The
   same seam, run against fixture content, proves the build failures of US-26 (exit status and
   message). Accessibility of the HTML surfaces is checked here with axe against WCAG 2.2 AA.
   Lighthouse and the download budget run against the same build in CI. Browsers in CI render WebGL
   in software, so this seam proves presence and wiring of the World, not its feel or frame rate.
2. **The World stepped without a renderer.** The World's model (Implementation decisions,
   Architecture) runs under
   Node with Rapier: tests feed key states, advance fixed timesteps and assert on the Puck
   (US-7 to US-10, US-12, US-14 at the model level: top speed by the blue line, glide length,
   staying inside the boards, Path crossing without a stall, Goal entry opening and re-arming,
   pause preserving state, Reset). This is deterministic and fast and does not need a GPU, which
   the agent's machine does not have (retro, 2026-10-07).

**Owner-measured.** Frame rate on the reference laptop named in the plan (AC-23.1), the browser
pass (AC-24.2), the visual quality of the World and the feel sign-off are measured by the Owner and
recorded in the ticket's PR, as the prototype's verdict was.

**Coverage rule.** Every acceptance criterion above maps to at least one test in seam 1 or seam 2,
or is marked Owner-measured (AC-23.1, AC-24.2). The Owner-measured cases depart from constitution
principle 2 as worded ("every acceptance criterion has at least one automated test"); the sixth
amendment under Constraints & dependencies covers them. The plan's test strategy lists the
mapping.

## Constraints & dependencies

- Stack and toolchain: ADR 0003. Pre-rendered root: ADR 0004. Puck feel: ADR 0005, primary source
  commit `d72851e` on branch `chore/puck-feel-prototype`, kept reachable by the merge commit of
  PR #5.
- Budget: the Owner has about 4 hours a week, roughly 45–50 hours over 12 weeks for spec, plan,
  Phase 0b and increment-1; no hard deadline. Touch input is the first thing cut if time is short.
- The Owner provides before Phase 3, as a dependency and not an agent task: the Exhibit-1 content
  (summary, 1–3 images with alternative text, optional video, "what I'd do differently"), the Bio,
  the Title Screen's one line, the two Announcer captions and a social preview image.
- Handed to the plan, not blockers for this spec (issue #3): hosting with per-PR previews (GitHub
  Pages with artifact preview, Cloudflare Pages, Vercel, Netlify, Azure Static Web Apps); buying a
  domain (a human task in the hosting ticket); the pre-rendering mechanism; the LICENSE split (code
  MIT, vendored components keep their licenses, content all rights reserved) as its own small
  ticket; the CI performance profile and the instrument for "World playable".
- Constitution: the five amendments proposed in issue #3 are applied at ratification after this
  spec. This spec relies on two of them now: nothing gates content, and no third-party scripts, no
  storage, nothing counted. It adds a sixth, for principle 2: "every acceptance criterion has at
  least one automated test, or a recorded Owner measurement where no automated seam exists"
  (AC-23.1, AC-24.2).
- Scope guard: if time runs short, these may be deferred by an `amend:` commit, in this order:
  AC-27.1 (ship one optimised size), AC-22.2, AC-17.3's viewport sizing.

## Non-goals

**Deferred to later increments** (planned, not refused):

- Touch input (increment-2 at the latest, first cut if time is short).
- The other four Exhibits: LabTrack, LabReg, DSP expansion board, Homelab.
- Any Challenge.
- The "visit in the World" action from a Panel opened on the Title Screen (may slip to
  increment-2).
- The CV; audio (off until the Visitor turns it on, when it comes); persistence; analytics; any
  backend (leaderboard, form); bilingual content; lazy-loading of Zones.

**Refused** (not planned at all):

- Gamepad input.
- Babylon.js, Godot or any stack other than ADR 0003.
- Third-party embeds or scripts of any kind.
- A LinkedIn link (none exists).
- Any mechanism that gates an Exhibit behind a Challenge, a device check or a capability.

## Open questions

none (the draft's thirteen questions were resolved by the Owner in the review of PR #6 on
2026-10-08; the answers are in the body above).

## Traceability

- Input: issue #3 "increment-1: grilling outcome", including its comment on the Puck-feel result.
- Vocabulary: `GLOSSARY.md` (PR #4).
- ADR 0003 (stack), ADR 0004 (pre-rendered root and Fallback Page), ADR 0005 (Puck feel, fixed-yaw
  Follow Camera); prototype commit `d72851e` (PR #5).
- Constitution v0.1-DRAFT, principles 1, 2, 5, 6, 8 and the amendments proposed in issue #3.
- PR #6: `/code-review` findings and the Owner's resolution of the open questions and derived
  decisions, 2026-10-08.
- Later: the plan for increment-1 and the tickets from `/to-tickets` reference acceptance criteria
  by their AC numbers.

## Further notes

- The spec deliberately keeps the Puck's reference numbers in brackets. The requirement is the feel
  in words (ADR 0005); the numbers let the headless World tests start with concrete tolerances.
- increment-1 has exactly one Exhibit, so the Title Screen list has one entry and the World has one
  Path and one Zone. Nothing here assumes one; the content schema, the list and the Fallback Page
  are written for many, so later increments add files, not features.
- The independent review of this spec (workflow guide §4.1 step 4) should look first at the
  Implementation decisions and the Scope guard, then at vocabulary drift from `GLOSSARY.md`, then at
  whether each acceptance criterion is testable at one of the two seams.
- Glossary gaps noticed while writing, for `/domain-modeling`: the Title Screen's "one line", the
  "way-in control", the "key legend", and the content field names `summary` and `links`, which the
  glossary avoids for Bio and Contact but issue #3 uses as Exhibit fields.
