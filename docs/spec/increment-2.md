# Spec: increment-2            Status: amended    Owner: Thomas (@cov1983)

Written 2026-11-05 by `/to-spec` from issue #59 (body of 2026-10-19 and the Owner's consolidated
Phase 1 answers of 2026-11-04, Q1–Q18 and D1–D8), issue #67, constitution v1.1, ADR 0016 and the
review threads of PR #82. No new interview was held. Where #59's body and the 2026-11-04 answers
differ, the answers win and the body's items become Deferred non-goals. Terms in capitals are
defined in `GLOSSARY.md`; "token" names only the signing mechanism of an Invite, as ADR 0016 does.
The nine questions the draft raised were resolved by the Owner in the Desktop review of
2026-11-05 and are folded into the body below; *Open questions* is empty. Status stays `draft`
until the `spec: approve increment-2` commit.

## Problem & goal

### Problem statement

Requests for web application projects reach the Owner in person, by phone and through channels
other than e-mail. There is no single, structured starting point. A Client the Owner has already
talked to has no way to describe a project in enough depth to start that project's Phase 1. The site
itself looks simple and old-school (#67). A prospective Client judges the Owner's craft by it, and
the craft should show from the first screen without giving up anything increment-1 proved: the
pre-rendered Title Screen, no third-party requests, reduced motion and the performance budget.

### Solution

One redesign of the whole site, so that it never looks like two sites (Q3). It is built on one
token set with a dark navy base, one electric-blue accent and exactly two effects. The Title Screen
becomes a hero over a static backdrop that quotes the World and crossfades into the World on entry.
The Puck becomes the mark. A sticky bar leads to the Exhibits and to "Start a project". Beside the
redesign comes a new address family. /start is a plain-HTML page that says how to get in touch and
how the Discovery Form works. /start/discovery is the Discovery Form, opened only by an Invite the
Owner mints on the host with `make invite`. The Client fills in seven sections, keeps a Draft in
their own browser and sends. One serverless function in the existing Vercel project checks the
Invite and sends two plain-text mails: the Brief to the Owner and a short confirmation to the
Client. Nothing is stored anywhere but the Owner's mailbox.

increment-2 is T0 (the redesign of #67: foundation and re-skin), /start, the invited English
Discovery Form, the invite CLI and the one function (Q1, D1). World shaders and the World visual
polish stay in #68 and #43.

## Users & context

- **Visitor** (every increment-1 case unchanged: keyboard and a 3D-capable browser, phone or tablet,
  assistive technology or no script or no WebGL, `prefers-reduced-motion`): meets the re-skinned
  Title Screen, Exhibit Panel, Fallback Page and World overlay, the sticky bar and /start. Nothing a
  Visitor could reach in increment-1 moves behind anything new.
- **Client**: a Visitor with an Invite, someone the Owner has already talked to, often not
  technical. Fills in a long Discovery Form (about 15–20 minutes, possibly in several sittings on
  the same device), in English. Must never lose their answers to a reload, and must always have a
  way out to the Owner's address when something fails.
- **The Owner**: mints Invites on the Owner's own host, reads Briefs in the Owner's mailbox, and
  answers from there. Works solo on about 4 hours a week.
- **Link previews and crawlers**: as increment-1 for the root address; /start carries its own title
  and description.

The site stays static apart from one function at the Discovery Form's submit boundary (principle 5
as amended in v1.1). The only first-party storage is the Draft, on /start/discovery only (principle
10). There are still no analytics and no third-party scripts, fonts or embeds.

## User stories & acceptance criteria

Acceptance criteria are Given / When / Then. Where an increment-1 criterion is named, it keeps
holding on the re-skinned surface; this spec adds to it and does not restate it.

### Look and tokens

- **US-1** As a Visitor, I want the site to look modern and of one piece, so that the craft shows
  before I read a word.
  - AC-1.1 Given any HTML surface (Title Screen, Exhibit Panel, Fallback Page, World overlay,
    /start, Discovery Form), When its colours are inspected, Then they come from the one token set:
    a dark navy base and one accent, electric blue. There is no light theme and no variant for
    `prefers-color-scheme: light` (D3, D5).
  - AC-1.2 Given every surface, When its animated or decorative effects are listed, Then there are
    exactly two: the headline reveal on the Title Screen and the static blue edge-glow gradient
    (D6). The Title Screen–World crossfade (US-2) is a transition, not an effect.
  - AC-1.3 Given the sticky bar and the favicon, When they are inspected, Then both show the
    redrawn Puck (a glossy dark disc with a blue rim) from the same drawing (D8).
  - AC-1.4 Given a full visit (Title Screen, World, Goal, Panel, Fallback Page, /start, Discovery
    Form with a submit), When all network requests are listed, Then every request goes to the site's
    own origin, and the one font is served from there (increment-1 AC-28.1 widened).
  - AC-1.5 Given the re-skinned site, When increment-1's automated acceptance criteria run, Then all
    of them hold.

### Title Screen hero

- **US-2** As a Visitor, I want the Title Screen to feel like the start of the World, so that entry
  is fluid and not a page change.
  - AC-2.1 Given the Title Screen, When it is rendered, Then it is a hero over a static CSS/SVG
    backdrop that quotes the World (navy, blue edge glow, a grid with crosses, the Puck), composed
    to match the World's play view. The backdrop needs no WebGL and no World bundle (D2).
    Carried to #124 (amended by T0b, #103): every backdrop image on the first viewport measured a
    slow run mode before the World preload, so T0b ships the hero with the headline reveal and the
    static blue edge glow as a CSS gradient on the hero, no image, and #124 brings the grid, the
    crosses and the Puck (Owner, #103 comments 6728114096 and 6728535535).
  - AC-2.2 Given script is disabled, When the root address loads, Then the headline and all of
    increment-1 AC-1.2's content are visible: the headline reveal never hides content that script
    would have to show.
  - AC-2.3 Given the Visitor activates the Way-in control, When the World becomes playable, Then the
    Title Screen fades and lifts out while the World fades in, without a second key press
    (increment-1 AC-4.2).
  - AC-2.4 Given `prefers-reduced-motion` is set, When the Title Screen appears and when the World
    is entered, Then the headline reveal and the crossfade are instant.
  - AC-2.5 Given the Visitor is in the World, When they press Escape and then Enter, Then
    increment-1 AC-6.1 and AC-6.2 hold through the crossfade.

### Sticky bar

- **US-3** As a Visitor, I want one bar that always leads to the Exhibits and to starting a project,
  so that I find both from any page.
  - AC-3.1 Given the Title Screen, the Fallback Page (/exhibits), /start or /start/discovery, When
    it is shown and scrolled, Then a sticky bar stays visible with the mark on the left and, on the
    right, "Exhibits" (to the Fallback Page) and a filled "Start a project" (to /start) (D7; the
    Discovery Form added in the Desktop review of 2026-11-05).
  - AC-3.2 Given /start or /start/discovery, When the bar is inspected, Then "Start a project" is
    marked as the current page.
  - AC-3.3 Given the Visitor is in the World, When a frame is shown, Then the bar is hidden: not
    visible, not focusable and not exposed to assistive technology.
  - AC-3.4 Given script is disabled, When the bar's links are activated, Then they navigate.

### Re-skinned surfaces

- **US-4** As a Visitor, I want every increment-1 surface in the new look without losing anything,
  so that the redesign costs me no function.
  - AC-4.1 Given the Exhibit Panel and the Fallback Page, When they are rendered in the new look,
    Then increment-1 US-16, US-19 and US-20 hold, including readability from 320 px and the focus
    rules.
  - AC-4.2 Given the World's overlay, When it is inspected, Then it holds exactly what increment-1
    names (the current caption, the Reset control, the key legend) and the capability hints, in the
    new look.
  - AC-4.3 Given any re-skinned surface, When axe runs against WCAG 2.2 AA, Then it reports no
    violation, colour contrast included.

### /start

- **US-5** As a Visitor who wants to start a project, I want one page that tells me how, so that I
  know whether to write or to wait for an Invite.
  - AC-5.1 Given /start is loaded with script disabled, When it is read, Then it shows the Owner's
    one sentence, the Contact, and a "Start a project" section explaining that the Discovery Form
    opens with an Invite the Owner sends (Q2).
  - AC-5.2 Given /start is fetched without executing script, When the response is parsed, Then it is
    pre-rendered HTML with its own title and description.
  - AC-5.3 Given a visit to /start, When requests are listed, Then neither the World bundle nor the
    Discovery Form's code is requested.
  - AC-5.4 Given a visit to /start, When cookies, local storage, session storage and IndexedDB are
    inspected afterwards, Then they are empty of anything the site wrote.

### Discovery Form: opening it

- **US-6** As a Client, I want my Invite to open a form that knows who I am, so that I start
  straight away.
  - AC-6.1 Given a valid Invite in the fragment of /start/discovery, When the page loads, Then it
    greets the Client by the Invite's name and prefills the contact fields from the Invite's name
    and e-mail (#59). The prefilled fields stay editable. Typed values go into the Brief's body
    only, and the Invite's e-mail stays the Brief's Reply-To and the confirmation's sole recipient.
    The greeting renders at most 80 characters of the Invite's name.
  - AC-6.2 Given /start/discovery#… is opened, When the requests the browser sends are listed, Then
    none of their URLs contains the Invite.
  - AC-6.3 Given an Invite that is expired or cannot be read, When the page loads, Then the
    Discovery Form is not shown and a message says the Invite is no longer valid and names
    hello@thomascova.dev. An expired Invite clears any Draft (PR #82, carried item a); an Invite
    that cannot be read leaves it as it is, like no Invite (AC-6.4; amended by T0b, #103).
  - AC-6.4 Given script runs and the fragment carries no Invite, When the page loads, Then the
    Discovery Form is not shown, the message of AC-6.5 is shown, and a Draft whose stored expiry has
    not passed is left as it is (AC-6.7).
  - AC-6.5 Given /start/discovery is loaded with script disabled, When it is read, Then a
    pre-rendered plain-HTML message says the Discovery Form needs script and an Invite, and gives
    the Contact (the obfuscated hello@ link) as the way to ask for one.
  - AC-6.6 Given a Draft started under one Invite, When the page is opened with a different
    readable, unexpired Invite whose signature differs from the one stored with the Draft, Then the
    Draft is cleared before the Discovery Form is shown.
  - AC-6.7 Given a Draft whose stored Invite expiry has passed, When /start/discovery is visited,
    with or without an Invite, Then the Draft is cleared.
  - AC-6.8 Given /start/discovery is loaded, When requests are listed, Then the World bundle is not
    requested.

### Discovery Form: filling it in

- **US-7** As a Client, I want a long form that guides me section by section, so that I can answer
  well without technical knowledge.
  - AC-7.1 Given the Discovery Form, When its sections are listed, Then there are seven, in the
    mockup's order: The basics; Problem & outcomes; People & tasks; First release; Design & content;
    Data & requirements; Plan & ownership. A review step follows them (Q15). Final wording is the
    Owner's copy.
  - AC-7.2 Given any section, When the Client uses the section navigation, Then every section and
    the review step can be reached, and the progress indicator shows how many sections are complete.
  - AC-7.3 Given a required question is unanswered, When the Client moves to submit, Then the form
    names each such question, links to it, and does not submit.
  - AC-7.4 Given any question, required or not, When the Client answers "Not sure — please advise",
    Then the answer is accepted and satisfies the requirement.
  - AC-7.5 Given the review step, When it is shown, Then every answer appears under its section, and
    each section can be reopened from there to change an answer.
  - AC-7.6 Given only a keyboard, When the Client fills in every section, reviews and submits, Then
    every control is reachable and operable, focus stays visible, and focus moves to the section
    heading on each section change.

### Discovery Form: the Draft

- **US-8** As a Client, I want my answers kept on this device until I send them, so that a reload
  or a break does not cost me twenty minutes.
  - AC-8.1 Given answers were entered, When the page is reloaded or reopened with the same Invite,
    Then the answers and the current section are restored from the Draft.
  - AC-8.2 Given a full visit, When local storage is inspected, Then the Draft is the only thing the
    site wrote, under one key, and no page other than /start/discovery writes it (principle 10;
    increment-1 AC-28.2 holds for every other page).
  - AC-8.3 Given a Draft exists, When the Client activates the visible clear control and confirms,
    Then the Draft is removed from storage and the form is empty.
  - AC-8.4 Given a Brief is accepted by the function, When the confirmation is shown, Then the Draft
    has been removed from storage.
  - AC-8.5 Given local storage is unavailable (blocked or full), When the Client fills in the
    Discovery Form, Then it works without a Draft, and one line says the answers are kept only
    until the page is closed. No other storage is tried as a fallback.

### Discovery Form: consent

- **US-9** As a Client, I want to know what happens to my answers before I send them, so that I can
  agree knowingly.
  - AC-9.1 Given the review step, When the area above submit is read, Then an inline statement says
    what is sent, to whom, where it lands and how long it is kept, and contains the Owner's sentence
    verbatim: "I keep your answers while your request is open and delete them once it is concluded
    or declined, at the latest 12 months after you sent them." (Q7, Q8)
  - AC-9.2 Given the consent checkbox above submit is not ticked (it is never pre-ticked), When the
    Client submits, Then nothing is sent and the checkbox is named as required.
  - AC-9.3 Given /start/discovery is fetched without executing script, When the response is parsed,
    Then the consent statement is present as plain HTML (Q16).

### Discovery Form: sending

- **US-10** As a Client, I want to send my answers and know they arrived, so that I can stop
  worrying about them.
  - AC-10.1 Given a valid Invite, consent and every required answer, When the Client submits, Then
    the page sends one POST to the site's own origin, with the Invite in a request header and never
    in the URL, and on acceptance shows an on-screen confirmation.
  - AC-10.2 Given the function cannot send the Brief, When the Client submits, Then the page shows
    an error that names hello@thomascova.dev as the way out, and the Draft is kept (Q13; that the
    function stores nothing is AC-13.7).
  - AC-10.3 Given an Invite within its expiry has been used to send a Brief, When the Client submits
    again, Then a further Brief is sent. Each sending is its own Brief, and the newest wins (Q11).
  - AC-10.4 Given the Brief is sent and the confirmation mail fails, When the function answers,
    Then the Client sees the on-screen confirmation, the Draft is cleared, and the function's log
    records the failed confirmation as a status only. There is no alert in v1 (ADR 0016).
  - AC-10.5 Given the Invite expired while the Client was filling in, or does not verify, When the
    function rejects the Invite at submit, Then the error naming hello@thomascova.dev appears over
    the review step with every answer still on screen so the Client can copy them, and the Draft is
    removed from storage at the same moment, so nothing remains once the page is left.
  - AC-10.6 Given the function rejects the request itself (method, size or validation), When the
    Client submits, Then the page shows an error naming hello@thomascova.dev and the Draft is kept.

### Mails

- **US-11** As the Owner, I want each Brief as one text mail I can answer directly, so that the
  Client's project starts from my inbox.
  - AC-11.1 Given the function accepts a sending, When the Brief is sent, Then it is one plain-text
    mail to hello@thomascova.dev, From forms@thomascova.dev, Reply-To the e-mail inside the Invite
    (never a typed value), through Infomaniak's SMTP on port 465 logged in as
    postmaster@thomascova.dev. Its body holds every answer, including the contact fields as typed
    (Q13; AC-6.1).
  - AC-11.2 Given the Brief, When its body is read, Then it is plain text with Markdown headings: at
    the top, the Invite's name and e-mail and the sending time; then one heading per form section in
    the form's order, each question followed by its answer.
  - AC-11.3 Given the Brief, When its Subject is read, Then it is "Brief: " followed by the Invite's
    name with CR/LF stripped.
  - AC-11.4 Given any submit, When the headers of both mails are inspected, Then they contain only
    fixed text and values from the Invite. No value from the request body appears in any header,
    Subject included (PR #82, carried item b).
- **US-12** As a Client, I want a short confirmation in my inbox, so that I know a person will read
  it.
  - AC-12.1 Given the Brief is sent, When the confirmation mail is sent, Then it goes only to the
    e-mail inside the Invite, never to an address typed in the form, From forms@thomascova.dev,
    Reply-To hello@thomascova.dev (Q9, Q13).
  - AC-12.2 Given the confirmation mail, When its Subject and text are read, Then they are the
    Owner's text verbatim, emojis included, and hold no copy of the answers. The first line is the
    Subject, and the body starts at "Thanks for reaching out!":

    > Message received. Ideas loading... 🚀
    >
    > Thanks for reaching out!
    >
    > Your message has successfully made it through the digital universe and landed safely in my
    > inbox. No bugs, no smoke, no unexpected explosions. So far, so good! 😄
    >
    > I'll take a look at your request and get back to you as soon as possible.
    >
    > In the meantime, keep those great ideas coming. The best projects often start with a simple
    > "What if...?"
    >
    > Talk soon!

    (In the source the lines are separated by " / ".)

### The Discovery Form's submit function

This spec names it, as principle 5 requires: **the Discovery Form's submit function** (in this spec
"the function").

- **US-13** As the Owner, I want the function to refuse everything that is not a valid Invite's
  Brief, so that it can never be used to send mail for anyone else.
  - AC-13.1 Given a request whose Invite signature does not verify, When it reaches the function,
    Then the response is a rejection and no mail is handed to SMTP.
  - AC-13.2 Given a request whose Invite has expired, When it reaches the function, Then the
    response is a rejection and no mail is handed to SMTP.
  - AC-13.3 Given a body larger than the limit, When it reaches the function, Then it is rejected
    and no mail is sent.
  - AC-13.4 Given a request that is not a POST, When it reaches the function, Then it is rejected.
  - AC-13.5 Given an Invite whose name contains CR or LF, When the function uses the name anywhere
    (a display name, a Subject, the body), Then the CR and LF characters have been stripped first
    (principle 4; PR #82, carried item b).
  - AC-13.6 Given any request, accepted or rejected, When the function's log is read, Then it holds
    a status and nothing personal: no name, no e-mail, no answer, no Invite.
  - AC-13.7 Given any request, When it has been handled, Then the only outbound calls recorded are
    to the SMTP mock and no file is written.

### Invites

- **US-14** As the Owner, I want to mint an Invite with one command on my host, so that inviting a
  Client takes a minute.
  - AC-14.1 Given the signing secret in the host's environment, When the Owner runs `make invite`
    with the Client's name and e-mail, Then it prints a link to /start/discovery carrying the Invite
    in the fragment, with language `en` and an expiry of 30 days unless another number of days is
    given (Q10). The link's origin is the production address, https://thomascova.dev, unless an
    option overrides it for a preview deployment.
  - AC-14.2 Given the signing secret is missing, When `make invite` runs, Then it fails, names the
    missing variable and prints no link.
  - AC-14.3 Given a language other than `en`, When `make invite` runs, Then it fails: increment-2 is
    English only.
  - AC-14.4 Given an e-mail that is not exactly one address, or a name or e-mail containing CR, LF
    or any other control character (U+0085 and U+2028 included), or a name longer than 80
    characters, When `make invite` runs, Then it fails and prints no link. The page's 80-character
    cap (AC-6.1) is defence in depth.

### Quality

- **US-15** As a Visitor or a Client on any current browser and with any input, I want every new
  and re-skinned surface to work, so that the redesign shuts nobody out.
  - AC-15.1 Given Chromium, Firefox and WebKit at the versions Playwright ships, When the automated
    suite runs, Then every automated acceptance criterion of this spec holds in all three.
  - AC-15.2 Given /start, the Discovery Form and every re-skinned surface, When axe runs against
    WCAG 2.2 AA and a keyboard-only pass drives them, Then axe reports no violation and the pass
    completes (Q17).
  - AC-15.3 Given the current browsers available to the Owner, When the Owner exercises the Title
    Screen, the World, the Fallback Page, /start and the Discovery Form once in this increment, Then
    they work and the result is recorded in the PR (as increment-1 AC-24.2).
- **US-16** As a Visitor, I want the redesign to cost the World nothing, so that it is still fast.
  - AC-16.1 Given the re-skinned site, When CI's performance budget runs on the root address, Then
    increment-1's lines hold unchanged: Title Screen interactive ≤ 2 s, World playable ≤ 5 s,
    ≤ 4 MB compressed until playable (Q17).
  - AC-16.2 Given the built output, When the chunks the root address loads until the World is
    playable are listed, Then none of them carries code of the Discovery Form or the function.
  - AC-16.3 Given the delivered font, When its file is measured, Then it is one Latin-subset
    variable woff2 under 100 KB (D4).

## Non-functional requirements

**Performance** (CI budget unchanged from increment-1, `perf/budget.json`)

| measure | target | where measured |
|---|---|---|
| Title Screen interactive | ≤ 2 s | Lighthouse, throttled 10 Mbit/s profile, CI (unchanged) |
| World playable | ≤ 5 s from navigation start | same profile, CI (unchanged) |
| Initial download until World playable | ≤ 4 MB compressed, Exhibit media excluded | build output, CI (unchanged); the Discovery Form and the function add nothing to it (AC-16.2) |
| Font | one file, Latin subset, variable, woff2, < 100 KB delivered | seam 1's build half, the emitted woff2's size (AC-16.3); each candidate measured in T0 |
| Frame rate in the World | ≥ 50 fps sustained | Owner, reference laptop (increment-1 AC-23.1, unchanged) |

**Typography (D4).** One self-hosted variable grotesk, Latin subset, woff2. Candidates: **Geist Sans
Variable** and **Manrope Variable**. T0 measures the delivered Latin woff2 of each, and the one
chosen must stay under 100 KB. The Owner picks one on the T0 Vercel preview. Each candidate's
licence is read from its source page before it enters the plan (CLAUDE.md, third-party code).

**Motion.** The headline reveal and the crossfade are CSS transitions and keyframes, switched off by
the `prefers-reduced-motion` media query (amended by T0b, #103). Under `prefers-reduced-motion` the
headline reveal and the Title Screen–World crossfade are instant (AC-2.4), and increment-1 US-11,
US-18 and US-25 keep holding. No content depends on an animation finishing.

**Accessibility.** WCAG 2.2 AA on /start, the Discovery Form and every re-skinned surface: axe in
seam 1 and a keyboard-only pass (AC-15.2). The Discovery Form uses labelled fields, grouped choices
with legends, errors tied to their fields, a visible focus and a focus move on each section change.
The 3D canvas stays as increment-1 scoped it.

**Security.**
- The Invite's token is HMAC-signed, not encrypted. It travels in the URL fragment and reaches the
  function only in a request header. The function verifies the signature with a constant-time
  compare and checks the expiry before it reads the body (ADR 0016, Q12).
- Body size is limited; the plan sets the limit from the largest possible Brief.
- Header hygiene: mail headers hold only fixed text and Invite values. CR/LF are stripped from the
  Invite's name before any use (AC-11.4, AC-13.5; principle 4).
- The confirmation mail goes only to the Invite's address, so the function is never an open relay.
- The signing secret and the mailbox credential (the device password of postmaster@) live in Vercel
  environment variables and in the Owner's host environment, never in the repository, a prompt or an
  agent's context (principle 4, principle 8).
- Response headers stay ADR 0012's. The CSP keeps `connect-src 'self'` for the POST; any change goes
  through the function ticket.
- Accepted risk, from ADR 0016: a leaked Invite can send repeatedly until it expires (30 days, with
  no per-IP limit in v1, Q12). Revocation is rotating the signing secret, which ends every open
  Invite.
- Accepted risk: the page cannot verify a signature, so a crafted link with a readable, unexpired
  Invite can clear a Draft on that device (AC-6.6). The page renders at most 80 characters of the
  Invite's name, so a crafted greeting on thomascova.dev stays short (AC-6.1).

**Availability.** Static files as in increment-1, plus one function. No alert on a failed send in
v1 (ADR 0016, accepted risk): the Client sees an error naming hello@, and the function's log
carries a status only. No numeric availability target.

**Internationalisation.** English only. The Invite carries a language, and `en` is the only value
increment-2 mints (AC-14.3). German is Deferred.

**Browsers.** As increment-1: current and previous major desktop versions of Chrome, Firefox, Safari
and Edge. The Discovery Form and /start must also work on mobile browsers, since they need no
keyboard-only World. Automated coverage is Chromium, Firefox and WebKit (AC-15.1), and the Owner
covers the rest once per increment (AC-15.3).

## Data & privacy classification

| data | classification | where stored | retention | who may see |
|---|---|---|---|---|
| Invite: the Client's name, e-mail, language, expiry, HMAC-signed | personal data of the Client, given by the Owner | in the URL fragment of the link the Owner sends; sent to the function in a request header only; never in a URL the browser sends, never in a log (see Constraints for what that covers until the function ticket confirms Vercel's request log); the host's shell history is a store to avoid, so `make invite` never takes name or e-mail as arguments | until its expiry (30 days by default) | the Client, the Owner, the function while it handles a request |
| Draft: the Client's unsent answers | personal and project data of the Client | the Client's own browser, one localStorage key, read and written by /start/discovery only | until a trigger fires: an accepted sending, the visible clear control, the page seeing an expired Invite (an unreadable one leaves it, amended by T0b, #103), the function rejecting the Invite at submit (expired or not verifying; PR #82, item a), the page opened with a different readable, unexpired Invite, or a visit to /start/discovery after the stored expiry has passed; indefinitely if the Client never returns. A failed Brief, a rejected request and a page opened without an Invite leave it as it is | the Client on that device |
| Brief: one sending of the answers | personal and project data of the Client; confidential | the Owner's mailbox only: never this repository, never a `docs/spec/discovery-<client>.md` here, never a prompt or an agent's context (Q6, principle 8); the Client's project gets its own private repository | "while your request is open … at the latest 12 months after you sent them" (Q8); the Owner deletes it by hand | the Owner |
| Confirmation mail | the Client's address and the fixed text; no answers | the Client's mailbox; Infomaniak's outbound mail | the Client's to keep | the Client |
| Function log | operational status only, nothing personal | Vercel's function log | Vercel's log retention | the Owner |
| Request seen by Vercel | Vercel runs the function as the processor and sees the request: the Invite in its header and the body in transit | not stored by the function (AC-13.7) | in transit | Vercel as processor |
| Mail in transit | Infomaniak is the mail provider: SMTP 465 from postmaster@ (From forms@) to hello@ and to the Client | Infomaniak's mail system, under the Owner's account | as the mailbox keeps it | Infomaniak as provider, the Owner |
| Exhibit content, Bio, Contact | unchanged from increment-1 | unchanged | unchanged | everyone |
| Visitor data on every page other than /start/discovery | none collected, stored, counted or sent anywhere (unchanged from increment-1) | nowhere | n/a | n/a |

The consent statement (AC-9.1) is the Client's notice of the Brief's path and retention until the
legal pages arrive (Deferred). No Brief, answer or Invite value ever enters a test fixture: tests
use invented Clients.

## Implementation decisions

Decisions below come from the sources named at the top. There are no file paths and no code.

**Design system (T0, #67, D1–D8)**

- Tailwind CSS v4 for layout and tokens; shadcn/ui components copied into the repository, not used
  as a runtime package of their own; Lucide React as the one icon set; CSS transitions and keyframes
  for the crossfade and the headline reveal (amended by T0b, #103). Any effect taken from React
  Bits or Magic UI is copied in, not added as a dependency (#67).
- One token set, dark only: navy base, one electric-blue accent tuned to agree with the World's ice
  highlights (D5). The site's current stylesheet is replaced, not layered under the new one (#67).
- The pre-rendered Title Screen stays hydration-identical, and the existing build test stays the
  hydration proof (#67).
- The hero is option (a) of D2: static CSS/SVG over the Title Screen, no live World behind it. The
  headline reveal must leave the headline readable without script (AC-2.2).
- The sticky bar shows on the Title Screen, /exhibits, /start and /start/discovery, with "Start a
  project" marked as the current page on the last two, and is hidden in the World (D7, extended to
  the Discovery Form in the Desktop review of 2026-11-05).
- The Puck, redrawn by the Owner, is the mark and the favicon (D8).
- T0 has one ADR for the design system (Q1, D1).

**Routes**

- /start is pre-rendered plain HTML like the Fallback Page and needs no script (Q2, Q16).
- /start/discovery is its own route with its own chunk. The Discovery Form needs script (Q16). Its
  pre-rendered output holds the consent statement (AC-9.3) and the message for a page without script
  or without an Invite, with the Contact as the way to ask for one (AC-6.4, AC-6.5). Neither route
  loads the World bundle, and the root address never loads the form's code (AC-16.2).

**Invite (Q10, ADR 0016)**

- The token carries name, e-mail, language (`en`) and expiry (30 days by default), signed with one
  HMAC secret.
- `make invite` mints it on the Owner's host, where the secret lives in the host's environment. The
  agent never runs it and never holds the secret. How the target reaches Node 24 on the host (the
  devcontainer image with the secret passed in, or the host's own Node) is a plan decision under
  CLAUDE.md's toolchain rule.
- The plan decides how `make invite` reads the name and e-mail: from a prompt or the environment,
  never as arguments, so they never land in the host's shell history.
- The link carries the Invite in the fragment. Its origin is the production address unless an
  option of `make invite` overrides it for a preview (AC-14.1).
- The page reads name and e-mail from the Invite for the greeting and the prefill (AC-6.1), and can
  tell an expired or unreadable Invite on its own. Only the function can tell a tampered one. The
  greeting renders at most 80 characters of the name.
- The prefilled contact fields stay editable. Typed values go into the Brief's body only. The
  Invite's e-mail stays the Brief's Reply-To and the confirmation's sole recipient (AC-6.1,
  AC-11.1).
- Multi-use within the expiry; each sending is one Brief (Q11). No single-use (Refused).

**Draft (Q5, principle 10, ADR 0016)**

- One localStorage key, read and written only by /start/discovery. It holds the answers, the
  current section, and the expiry and signature of the Invite it was started under. The Draft
  stores no Invite field beyond expiry and signature; the contact answers it holds are the
  Client's, as typed or prefilled.
- It is cleared on an accepted sending, by the visible clear control, when the page sees an expired
  Invite (an unreadable Invite leaves it, like no Invite; amended by T0b, #103), when the function
  rejects the Invite at submit (the answers stay on screen until the page is left, AC-10.5), when
  the page is opened with a different readable, unexpired Invite whose signature differs from the
  stored one (AC-6.6), and on any visit to /start/discovery once the stored expiry has passed
  (AC-6.7). A failed Brief, a rejected request and a page opened without an Invite or with one
  that cannot be read leave it as it is (AC-10.2, AC-10.6, AC-6.3, AC-6.4).
- Where local storage is unavailable, the form runs without a Draft and says so in one line; no
  other storage is tried (AC-8.5).

**The function (Q12–Q14, ADR 0016)**

- One serverless function in the existing Vercel project, an `api/` route beside the static build,
  POST only. Order: check the Invite (signature by constant-time compare, then expiry) before the
  body is read, then read the body within the size limit, validate it, build the Brief, send the
  Brief, then send the confirmation, then answer.
- The answer is a success once the Brief is sent. A failed confirmation after that still answers
  success and logs a status only (AC-10.4). A failed Brief answers an error (AC-10.2).
- The function answers in one of four response classes, and the page acts on each:
  - accepted: the on-screen confirmation, the Draft cleared (AC-8.4, AC-10.1, AC-10.4);
  - Invite rejected (expired, or the signature does not verify): the error over the review step
    with the answers on screen, the Draft cleared (AC-10.5);
  - request rejected (method, size or validation): an error naming hello@, the Draft kept
    (AC-10.6);
  - send failed (the Brief could not be sent): an error naming hello@, the Draft kept (AC-10.2).
- How each class is encoded on the wire (a status code or a fixed body field) is a plan decision,
  shared by the page and the function.
- Mail through Infomaniak authenticated SMTP on port 465, logged in as postmaster@thomascova.dev
  with a device password of postmaster@. Both mails are From forms@thomascova.dev (an alias of
  postmaster@, which redirects to hello@).
  - Brief: plain text, To hello@thomascova.dev, Reply-To the Invite's e-mail, Subject "Brief: " and
    the Invite's name with CR/LF stripped. The body is Markdown headings in plain text: the
    Invite's name and e-mail and the sending time at the top, then one heading per form section in
    the form's order, each question followed by its answer (AC-11.2, AC-11.3). Mapping it to the
    spec template is the Owner's work in the Client's own repository.
  - Confirmation: plain text, To the Invite's e-mail only, Reply-To hello@thomascova.dev; Subject
    "Message received. Ideas loading... 🚀", body the rest of the Q9 text verbatim (AC-12.2).
- The send step is one module, so a transactional provider can replace SMTP later without touching
  the rest (#59).
- `vercel.json`, the CSP (`connect-src 'self'`) and a note on ADR 0006 change in the function
  ticket (ADR 0016).
- The function stores nothing and logs a status only (AC-13.6, AC-13.7).

**Content**

- The seven sections' questions, hints, options and the "Not sure — please advise" option are data
  in the repository, not markup. The mockup (`mockups/project-discovery/`) is the reference for
  content and flow, not for code or styling (#59).
- The Owner's /start sentence and the final EN copy of the seven sections are content files of the
  Owner (CODEOWNERS), validated at build like increment-1's content.

## Testing decisions

**What makes a good test here.** As increment-1: a test observes what a Visitor, a Client, the
Owner's mailbox or the build can observe. That means rendered HTML, focus, network requests, the
stored Draft, the function's response, the mails it hands to SMTP, and the CLI's output and exit
status. One assertion concept per test, behaviour-level names in the glossary's terms, no sleeps,
no jsdom and no component tests (CLAUDE.md). Fixtures use invented Clients and invented secrets that
look random (CLAUDE.md, secret-scanner fixtures).

**Seams** (Q18)

1. **The build and its output in a browser** (as increment-1). Playwright drives the built output in
   Chromium, Firefox and WebKit, with axe against WCAG 2.2 AA. It is extended to /start,
   /start/discovery with the submit endpoint stubbed (valid, expired and unreadable Invites, no
   Invite, a different Invite; no script; the Draft across reloads, its clear and unavailable
   storage, a Draft past its stored expiry; consent; the review step; each of the four response
   classes and what the page does with the Draft; the answers on screen after an Invite is rejected
   at submit; the Invite in a header and never in a URL), the sticky bar, reduced motion,
   the keyboard-only pass and every re-skinned surface. Its build half checks the spawned build's
   output as text: /start pre-rendered, the consent statement and the no-script message present, no
   form code in the root's chunks, the emitted woff2's size (AC-16.3), and no colour literal outside
   the token file (AC-1.1). Lighthouse and the download budget run as today.
2. **The World stepped without a renderer** (unchanged).
3. **The function under Node with SMTP mocked** (new). The function is called as Vercel calls it,
   and the mock SMTP records what it is handed. Cases: a valid Invite sends exactly two mails with
   the recipients, From, Reply-To and Subjects of AC-11.1, AC-11.3, AC-12.1 and AC-12.2; typed
   contact values reach the Brief's body and no header; a tampered or expired Invite gets a
   rejection and no mail is handed to SMTP; an oversized body is rejected; a non-POST is rejected;
   CR/LF in the name is stripped; no body value reaches a header; the log holds no personal value; a
   failed Brief gives the error response; a failed confirmation after a sent Brief gives success;
   each response class is distinguishable; a non-ASCII name and the confirmation's emoji Subject
   are encoded per RFC 2047 in the Subject and display name; the only outbound calls recorded are
   to the SMTP mock and no file is written (AC-13.7).
   The same verify module is exercised by the invite CLI's tests (mint, then verify; missing secret;
   non-`en` language; AC-14.4's address, control-character and name-length refusals).

**Vitest for form logic.** Validation (required answers, "Not sure — please advise"), section
navigation and progress, the review step's content, Draft read, write and clear (including the
stored expiry and signature checks of AC-6.6 and AC-6.7), and Invite parsing on the page (expired,
unreadable, the 80-character name cap). These are pure modules inside the coverage ratchet's scope.

**Owner-measured** (principle 2, recorded in the ticket's PR). One real send to hello@ before the
first test Client (both mails received, headers as specified). The hero crossfade and the T0 look on
the Vercel preview, including the font choice, exactly two effects (AC-1.2), the favicon and the
mark from the same drawing (AC-1.3) and the hero's composition against the World's play view
(AC-2.1, on #124's preview; amended by T0b, #103). The browser pass (AC-15.3, as increment-1
AC-24.2). The frame rate stays increment-1 AC-23.1's.

**Coverage rule.** Every acceptance criterion above maps to at least one test in seams 1–3 or the
Vitest form logic, or is marked Owner-measured. The plan's test strategy lists the mapping.

## Constraints & dependencies

- Stack: ADR 0003, unchanged for the World. Hosting: ADR 0006, the same Vercel project (Q14),
  never another (Refused). Headers: ADR 0012. Function and Draft: ADR 0016, constitution v1.1
  principles 5 and 10.
- increment-1 stays frozen. A sentence of it that T0 outgrows (for example the overlay's look or the
  Title Screen's composition) is amended by an `amend:` commit in the PR that outgrows it, never
  carried forward (`docs/spec/README.md`).
- New dependencies (Tailwind v4, Lucide React, shadcn/ui's peers, the SMTP client, the font
  files) are each researched in the plan at the newest version the toolchain's peer ranges accept,
  and listed in their PR with licence and reason (CLAUDE.md).
- The function ticket writes the runbook for the mail credential and the HMAC secret: where each
  lives, how to rotate it, and that rotating the secret ends every open Invite (ADR 0016).
- The function ticket confirms what Vercel's own request log records for a custom request header,
  and the runbook names it; until then, "never in a log" in the Data table means the function's log.
- The function ticket confirms the handler form that leaves the body unread until the Invite
  verifies (Vercel's Node helpers can buffer or parse a body before the handler runs).
- Budget: about 4 hours a week, solo.
- The Owner provides the redrawn Puck mark before T0a starts, as a dependency and not an agent task.
  The /start sentence and the final EN copy of the seven sections are placeholders the agent drafts
  (the copy from the mockup's text) and the Owner final-edits on T1's and T3b's PR (amended by T0b,
  #103).

### Carried open points (Owner decisions pending, not blockers for this spec)

- Vercel Hobby → Pro, the Anthropic Console organisation and the Supabase subscription all switch
  at the latest before the first paying Client (Hobby is non-commercial only). The Console and
  Supabase switch together with Hobby → Pro by Owner decision of 2026-11-05 (Desktop, the triage
  comment of ai-review round 1 on PR #88).
- A dedicated mailbox at that point; postmaster@ with the forms@ alias is the development setup.
- A pale form surface, only if the dark one reads badly (D3).
- A second design pass after the Owner's Figma work, including the hero over the live World with a
  camera move (D2; it needs budget numbers).
- The employment-contract check for side work, before the same point.
- PDF library and cold start (increment 3).

## Non-goals

**Deferred to later increments** (planned, not refused; Q1 bundles them into one "increment 3
candidate" issue):

- The public short intake at /start (and its honeypot and minimum fill time).
- German (formal Sie, ss, CHF) and a language switch.
- A PDF Brief, and a Markdown and raw-JSON Brief in the shape of #59's body.
- A copy of the answers to the Client.
- Legal pages: privacy notice and imprint, EN and DE.
- Prefill of the Discovery Form from a public intake.
- Resuming a Draft on another device; revising after submit.
- A script-free Discovery Form (Q16).
- Per-IP rate limiting (Q12; it arrives with the public intake).
- An alert on a failed send. That later spec also amends principle 5's observability sentence, so
  that the function's log is not read as a monitoring promise (PR #82, carried item e).
- World shaders, WebGPU and the shader-driven look (#68); the World visual polish (#43, with #68).

**Not in scope (ADR 0016 Considered):** Supabase, or any backend beyond the one function. A hosted
database is a possible later direction, not decided, and any backend beyond a form-boundary
function needs its own amendment and ADR.

**Refused** (not planned at all):

- A third-party form service.
- A captcha.
- Analytics.
- A database for Briefs.
- A Brief anywhere in this repository or in any agent's context (Q6).
- Single-use Invites, which would need server state.
- A Vercel project other than the existing one.

## Open questions

none (the draft's nine questions were resolved by the Owner in the Desktop review of 2026-11-05;
the answers are in the body above).

## Traceability

- Input: issue #59, body of 2026-10-19 (superseded where the answers differ) and the Owner's
  consolidated Phase 1 answers of 2026-11-04 (Q1–Q18, D1–D8); the comments of 2026-10-20 and
  2026-11-02 (the questions).
- The Owner's Desktop review of this draft, 2026-11-05: the nine open questions resolved, among
  them the prefilled contact fields (AC-6.1, AC-11.1), and the review findings folded in.
- PR #88, ai-review round 1 and the Owner's triage of 2026-11-05 (M1, m1–m11): the response
  classes, the Draft's triggers, the Invite input checks and the proofs of AC-1.1, AC-8.2, AC-16.3.
- Issue #67 (redesign stack and constraints), with its 2026-11-04 comment making it increment-2's
  T0.
- Out of scope: #68 (World visuals, shaders) and #43 (World visual polish, with #68).
- Constitution v1.1 (principles 2, 4, 5, 8, 10), ADR 0016 (function and Draft), ADR 0006 (hosting,
  the note the function ticket adds), ADR 0012 (headers), ADR 0003 (stack).
- PR #82, items carried into this spec from its reviews and the Owner's triage:
  - (a) the Draft is cleared on an expired or invalid Invite: AC-6.3, AC-6.7, AC-10.5, the Data
    table (narrowed by T0b's amend, #103: an unreadable Invite leaves the Draft as it is);
  - (b) header hygiene and CR/LF stripping: AC-11.4, AC-13.5;
  - (c) ADR 0016's Supabase sentence moved to its Considered list as "a possible later direction,
    not decided": an edit in this spec's branch;
  - (d) GLOSSARY's Draft definition gains "or their Invite is no longer valid": an edit in this
    spec's branch;
  - (e) an alert on a failed send and the principle 5 amendment: Deferred.
- Vocabulary: `GLOSSARY.md`, section `## Intake` (Client, Invite, Discovery Form, Brief, Draft).
- Reference: the project-discovery mockup (`mockups/project-discovery/`, ADR 0006 note).
- Later: the plan for increment-2 and the tickets from `/to-tickets` reference acceptance criteria
  by their AC numbers. The "increment 3 candidate" issue (Q1) is opened in the PR of the approving
  commit (CLAUDE.md, hand-offs).

## Further notes

- The independent review should look first at the Data & privacy table and the function's ACs
  (US-13), then at the decisions folded in from the Desktop review (AC-6.1, AC-6.4–AC-6.6,
  AC-8.5, AC-10.4, AC-10.5, AC-11.2, AC-11.3), then at whether AC-1.5 and AC-4.x are enough to
  keep increment-1's surfaces whole through T0.
- AC numbers restart at US-1. A reference to an increment-1 criterion always says "increment-1".
- Glossary gaps noticed while writing, for `/domain-modeling`: the "sticky bar", the "hero" and its
  "backdrop", "the Discovery Form's submit function", "the review step", and "Start a project" as a
  control name next to the Way-in control.
