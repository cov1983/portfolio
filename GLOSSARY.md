# Portfolio

Thomas's public portfolio site: a browser-based 3D world in which a visitor steers an ice-hockey
puck to discover his projects and background. Single context; this file is the shared vocabulary.
Terms are added as they are resolved in `/grill-with-docs`; definitions say what a thing *is*,
not how it is built.

## People

**Visitor**:
A person using the site. Primary Visitors are engineers and technically literate hiring managers;
everyone else is served the same content through the Fallback Page.
_Avoid_: user, player, viewer

**Owner**:
Thomas, the person the portfolio is about and the only one who publishes content.
_Avoid_: author, admin

## World

**World**:
The whole navigable 3D space the Visitor explores. It consists of one Hub and its Zones.
_Avoid_: scene, level, map, game

**Puck**:
The ice-hockey puck the Visitor steers through the World. It is the Visitor's only presence in
the World.
_Avoid_: player, avatar, ball, character

**Rink**:
A bounded playable surface inside the World. The Hub and every Zone each sit on a Rink.
_Avoid_: arena, floor, area

**Hub**:
The central Rink the Visitor starts on, from which paths branch to the Zones.
_Avoid_: lobby, main area, home

**Zone**:
A themed branch reached from the Hub that presents one Exhibit. The World is one continuous space;
a Zone is not loaded or entered separately.
_Avoid_: room, section, level, stage

**Path**:
The boarded corridor that connects the Hub to a Zone.
_Avoid_: corridor, tunnel, link, road

**Direct Drive**:
The way the Visitor steers the Puck: pressing a direction accelerates the Puck that way, and it
glides with momentum. The Puck is never struck by a stick during travel.
_Avoid_: shooting, hitting, tank controls

**Follow Camera**:
The third-person camera that trails the Puck during travel.
_Avoid_: top-down, bird's eye

**Goal**:
The hockey net in a Zone. Driving the Puck into it opens that Zone's Exhibit.
_Avoid_: trigger, portal, target, net

**Challenge**:
An optional hockey task in the World with a measurable result. A Challenge never decides what
content a Visitor can reach. None exists in increment one.
_Avoid_: quest, mission, level, minigame, unlock

**Announcer**:
The storytelling voice: one short caption per place, in the style of a rink public-address
announcer. Increment one has a welcome on the Hub and one caption at the Zone.
_Avoid_: narrator, tutorial text, guide

**Reset**:
The action that returns the Puck to the centre of the Hub, available at any time.
_Avoid_: respawn, restart, teleport

## Content

**Exhibit**:
One project of the Owner presented in the World and on the Fallback Page, backed by one content
file. Fields: title, hook, summary, role, tech, year, links, images, optional video,
"what I'd do differently", Visibility.
_Avoid_: project, showcase, card, portfolio item, case study

**Hook**:
The one-line teaser of an Exhibit, the first thing a Visitor reads about it.
_Avoid_: tagline, subtitle, teaser

**Visibility**:
Who an Exhibit's content may describe. `personal`: the Owner's own work, may be shown in full.
`employer-generic`: work done for an employer, shown only as problem, architecture, role and tech,
without real data, screenshots or repository links, and published only with the employer's consent.
_Avoid_: privacy level, classification

**Bio**:
The one-paragraph description of the Owner.
_Avoid_: about, profile, summary

**Contact**:
The ways to reach the Owner: an obfuscated e-mail link and the GitHub profile.
_Avoid_: socials, links

**Exhibit Panel**:
The readable overlay in which an Exhibit's full content appears, over the paused World after
scoring into its Goal, or directly over the Title Screen. In the World only the title and Hook are
shown, on a banner over the Goal.
_Avoid_: modal, popup, dialog, detail view

**Title Screen**:
The first screen a Visitor sees, at the site's root address: the Owner's name, one line, the way
into the World, the list of all Exhibits for direct access, and the link to the Fallback Page.
Picking an Exhibit here opens its Exhibit Panel without entering the World. The way into the
World is offered on every device; device checks only add a hint, never remove it.
_Avoid_: landing page, splash, menu, loading screen

**Fallback Page**:
The plain, accessible HTML rendering of every Exhibit, the Bio and the Contact, linked from the
first screen. It is what Visitors without 3D, with assistive technology or in a hurry use, and
what search engines and link previews read.
_Avoid_: 2D mode, lite version, text version, accessible version

## Delivery

**Increment**:
A shippable slice of the site with its own frozen spec. Increment one is: the Title Screen, the
Hub, one Zone with its Goal, the Puck with Direct Drive and Reset, Exhibit "this portfolio", the
Bio, the Contact, the Announcer's two captions and the Fallback Page; desktop keyboard only;
English only; static hosting; no backend; no Challenge; nothing stored or counted.
_Avoid_: phase, milestone, release, version
