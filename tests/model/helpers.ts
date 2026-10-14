// Shared helpers of the model seam: inputs, stepping and sampling, a seeded generator, the layout.
import { exhibitIdSchema } from '../../src/content/schema'
import { layoutFromContent, type Vec2, type WorldLayout } from '../../src/world/model/layout'
import {
  NO_INPUT,
  type DriveInput,
  type Place,
  type PuckState,
  type WorldEvent,
  type WorldModel,
} from '../../src/world/model/world'

/**
 * The World with one Zone, built the way the site builds it (layoutFromContent) from a small
 * fixture: the schema produces the Exhibit's id, so no cast, and nothing is read from disk. The
 * geometry does not depend on the text; AC-13.2's real-content check is layout.test.ts's.
 */
export function oneZoneLayout(): WorldLayout {
  return layoutFromContent({
    exhibits: [
      { id: exhibitIdSchema.parse('exhibit-1'), title: 'Exhibit 1', hook: 'A model fixture' },
    ],
  })
}

/**
 * The e2e journey's bound on the re-entry (exhibit-panel.spec.ts): after the Goal, STAY_S with no
 * key, ArrowDown for LEAVE_S, then ArrowUp for this much model time must score again. About 1.5×
 * the replayed journey's 1.68 s, and less than half of the 6.43 s a Puck reset by R needs for the
 * same sequence (goal.test.ts proves both), so a Reset while paused fails the journey (AC-12.3,
 * 14.2).
 */
export const REENTRY_BUDGET_S = 2.5
/** How long the journey waits with no key after Escape: the Puck stays in the Goal (AC-14.2). */
export const STAY_S = 0.5
/** How long the journey holds ArrowDown to leave the Goal. */
export const LEAVE_S = 0.75

export const NONE: DriveInput = NO_INPUT
export const UP: DriveInput = { ...NONE, up: true }
export const DOWN: DriveInput = { ...NONE, down: true }
export const LEFT: DriveInput = { ...NONE, left: true }
export const RIGHT: DriveInput = { ...NONE, right: true }
export const UP_RIGHT: DriveInput = { ...NONE, up: true, right: true }

/** Steps the model `steps` times with `input` and returns the Puck state after every step. */
export function drive(model: WorldModel, input: DriveInput, steps: number): PuckState[] {
  const samples: PuckState[] = []
  for (let i = 0; i < steps; i += 1) {
    model.step(input)
    samples.push(model.puck())
  }
  return samples
}

/** Steps with `input` until `done(state)` holds or `limit` steps have run; returns the step count and the state. */
export function driveUntil(
  model: WorldModel,
  input: DriveInput,
  done: (state: PuckState) => boolean,
  limit: number,
): { steps: number; state: PuckState } {
  let steps = 0
  let state = model.puck()
  while (steps < limit) {
    model.step(input)
    steps += 1
    state = model.puck()
    if (done(state)) break
  }
  return { steps, state }
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** mulberry32: a small seeded generator, so a random input sequence is the same on every run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInput(random: () => number): DriveInput {
  return { up: random() < 0.5, down: random() < 0.5, left: random() < 0.5, right: random() < 0.5 }
}

/** The same layout with the Puck starting at `point` (the Reset point moved by data, not by API). */
export function at(layout: WorldLayout, point: Vec2): WorldLayout {
  return { ...layout, hub: { ...layout.hub, resetPoint: point } }
}

/** The first sample where the Puck moves back along `axis` against `sign`, or −1: a rebound. */
export function reboundAt(samples: PuckState[], axis: 'x' | 'z', sign: number): number {
  return samples.findIndex((s) => Math.sign(s.velocity[axis]) === -sign && s.speed > 0.1)
}

/** What one step produced: the events, the Puck afterwards and where it is. */
export type StepRecord = { events: WorldEvent[]; state: PuckState; place: Place }

/** Steps the model `steps` times with `input` and records every step. */
export function collect(model: WorldModel, input: DriveInput, steps: number): StepRecord[] {
  const records: StepRecord[] = []
  for (let i = 0; i < steps; i += 1) {
    const events = model.step(input)
    records.push({ events, state: model.puck(), place: model.place() })
  }
  return records
}

/** The indexes of the steps that produced an event of `type`. */
export function stepsWith(records: StepRecord[], type: WorldEvent['type']): number[] {
  return records.flatMap((record, i) => (record.events.some((e) => e.type === type) ? [i] : []))
}
