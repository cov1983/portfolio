// App-level types shared with the scene (plan §5, Store and key routing): the World failure the
// scene reports. The store, the reducer, the key router and the focus rules live next to it in
// store.ts, keys.ts and focus.ts (T5a); src/world imports this file only.

/** Why the World could not start or stopped; AC-22.2 turns it into the readable message (T8b). */
export type WorldFailure = { kind: 'bundle' | 'webgl' | 'physics'; message: string }
