// App-level types (plan §5, Store and key routing). T1 holds only the World failure the scene
// reports; T5a adds the store, the reducer and the key router next to it.

/** Why the World could not start or stopped; AC-22.2 turns it into the readable message (T8b). */
export type WorldFailure = { kind: 'bundle' | 'webgl' | 'physics'; message: string }
