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
