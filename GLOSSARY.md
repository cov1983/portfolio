# Portfolio

Thomas's public portfolio site: a browser-based 3D world in which a visitor steers an ice-hockey
puck to discover his projects and background. Single context; this file is the shared vocabulary.
Definitions say what a thing *is*; scope, rules and numbers live in the spec and the ADRs.

## People

**Visitor**:
A person using the site. Primary Visitors are engineers and technically literate hiring managers.
_Avoid_: user, player, viewer

**Owner**:
Thomas, the person the portfolio is about and the only one who publishes content.
_Avoid_: author, admin

## World

**World**:
The whole navigable 3D space the Visitor explores: one continuous space made of the Hub, its
Paths and its Zones.
_Avoid_: scene, level, map, game

**Puck**:
The ice-hockey puck the Visitor steers through the World, the Visitor's only presence there.
_Avoid_: player, avatar, ball, character

**Rink**:
A bounded, boarded playable surface in the World. The Hub and every Zone are each a Rink.
_Avoid_: arena, floor, area

**Hub**:
The central Rink the Visitor starts on and that Paths lead away from.
_Avoid_: lobby, main area, home

**Path**:
The boarded corridor that connects the Hub to a Zone.
_Avoid_: corridor, tunnel, link, road

**Zone**:
A themed Rink reached from the Hub by a Path that presents one Exhibit.
_Avoid_: room, section, level, stage

**Goal**:
The hockey net in a Zone. Driving the Puck into it opens that Zone's Exhibit Panel.
_Avoid_: trigger, portal, target

**Banner**:
The sign over a Goal that shows the Exhibit's title and Hook inside the World.
_Avoid_: label, sign, billboard

**Direct Drive**:
The way the Visitor steers the Puck: pressing a direction accelerates the Puck that way and it
glides with momentum. The Puck is never struck by a stick during travel.
_Avoid_: shooting, hitting, tank controls

**Follow Camera**:
The third-person camera that trails the Puck during travel.
_Avoid_: top-down, bird's eye

**Reset**:
The action that returns the Puck to the centre of the Hub.
_Avoid_: respawn, restart, teleport

**Challenge**:
An optional hockey task in the World with a measurable result. A Challenge never decides what
content a Visitor can reach.
_Avoid_: quest, mission, level, minigame, unlock

**Announcer**:
The storytelling voice: one short text caption per place, in the style of a rink public-address
announcer.
_Avoid_: narrator, tutorial text, guide

## Content

**Exhibit**:
One project of the Owner, presented in the World and on the Fallback Page.
_Avoid_: project, showcase, card, portfolio item, case study

**Hook**:
The one-line teaser of an Exhibit, the first thing a Visitor reads about it.
_Avoid_: tagline, subtitle, teaser

**Visibility**:
Who an Exhibit's content may describe. `personal`: the Owner's own work. `employer-generic`:
work done for an employer, described only as problem, architecture, role and tech.
_Avoid_: privacy level, classification

**Bio**:
The one-paragraph description of the Owner.
_Avoid_: about, profile, summary

**Contact**:
The ways to reach the Owner.
_Avoid_: socials, links

**Exhibit Panel**:
The readable overlay in which an Exhibit's full content appears, over the paused World or over
the Title Screen.
_Avoid_: modal, popup, dialog, detail view

**Title Screen**:
The first screen a Visitor sees, at the site's root address: the Owner's name, one line, the way
into the World, the list of all Exhibits for direct access, and the link to the Fallback Page.
_Avoid_: landing page, splash, menu, loading screen

**Fallback Page**:
The plain, accessible HTML rendering of every Exhibit, the Bio and the Contact, usable without 3D,
without script and with assistive technology.
_Avoid_: 2D mode, lite version, text version, accessible version

## Delivery

**Increment**:
A shippable slice of the site with its own frozen spec. Increments are numbered; the first is
`increment-1`.
_Avoid_: phase, milestone, release, version
