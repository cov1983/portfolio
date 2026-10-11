// Shared helpers of the model seam: inputs, stepping and sampling, a seeded generator.
import type { Vec2 } from '../../src/world/model/layout'
import {
  NO_INPUT,
  type DriveInput,
  type PuckState,
  type WorldModel,
} from '../../src/world/model/world'

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
