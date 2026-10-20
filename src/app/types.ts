// App-level types shared with the scene (plan §5, Store and key routing): the World failure the
// scene reports. The store, the reducer, the key router and the focus rules live next to it in
// store.ts, keys.ts and focus.ts (T5a); src/world imports this file only.

/**
 * Why the World could not start or stopped; src/site/WorldFailure.tsx turns it into the readable
 * message (AC-22.2). `bundle`: the chunk or the ice texture did not load; `physics`: Rapier did
 * not initialise; `webgl`: the context was lost, or the browser has none; `render`: a throw
 * during the World's render, caught by the failure boundary (plan §5, corrected by #33).
 */
export type WorldFailure = { kind: 'bundle' | 'webgl' | 'physics' | 'render'; message: string }

/**
 * When the failure arrived (ai-review on #64, finding 9; round 2, Minor 1): `'play'` when the
 * Visitor was in the World and it was playable (it stopped: a lost context while steering, a throw
 * after entry), `'start'` otherwise (it could not start), a World preloaded and ready behind the
 * Title Screen included, since the Visitor never saw that one run. The heading of the readable
 * message reads from it; the kind alone cannot tell, since `webgl` names both a World that never
 * started (no context) and one that lost its context.
 */
export type FailurePhase = 'start' | 'play'

/** A failure as the app attributed it (src/app/capability.ts): what the store holds and the readable message shows. */
export type AttributedFailure = WorldFailure & { phase: FailurePhase }
