// PROTOTYPE — throwaway. Three ice-friction presets; pick one, describe the feel in words (ADR 0005).

export type Preset = {
  key: '1' | '2' | '3'
  name: string
  blurb: string
  /** Coulomb friction coefficient, puck on ice. Real ice ≈ 0.03–0.1. Decelerates at μ·g. */
  friction: number
  /** Rapier linear damping, 1/s. Velocity-proportional drag ("air"). 0 = pure Coulomb glide. */
  linearDamping: number
  /** Direct Drive acceleration while a key is held, m/s². */
  accel: number
  /** Speed cap, m/s. */
  maxSpeed: number
  /** Board bounciness. */
  restitution: number
}

export const PRESETS: Record<Preset['key'], Preset> = {
  '1': {
    key: '1',
    name: 'Slick',
    blurb: 'Near-real ice. Coasts a rink length, boards bounce, needs anticipation.',
    friction: 0.05,
    linearDamping: 0.2,
    accel: 18,
    maxSpeed: 14,
    restitution: 0.7,
  },
  '2': {
    key: '2',
    name: 'Standard',
    blurb: 'Compromise. Clear momentum, but it settles where you aim.',
    friction: 0.1,
    linearDamping: 0.4,
    accel: 24,
    maxSpeed: 12,
    restitution: 0.5,
  },
  '3': {
    key: '3',
    name: 'Grippy',
    blurb: 'Arcade. Stops fast, snappy direction changes, dead boards.',
    friction: 0.3,
    linearDamping: 1.2,
    accel: 32,
    maxSpeed: 10,
    restitution: 0.3,
  },
}

/** Shared mutable telemetry; the HUD polls it. Prototype shortcut, not a pattern. */
export const telemetry = {
  speed: 0,
  x: 0,
  z: 0,
  camMode: 'fixed' as 'fixed' | 'heading',
}
