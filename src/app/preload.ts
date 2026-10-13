// The World preload and entry policy (plan §2, Entry and preload policy; spec, Architecture): the
// `world` chunk is imported in an idle callback after the title-screen-interactive mark unless a
// coarse pointer was detected (selectWorldPreload, store.ts), and on entry when nothing imported
// it before. Pure: the import function and the host's scheduling functions are injected, so the
// policy is unit-tested without a DOM; src/app/App.tsx wires it to `import()` and `window`.
import type { AppState } from './store.ts'
import type { WorldFailure } from './types.ts'

/** What the loader tells the app: the store's world-status and the failure action (its UI is T8b's). */
export type LoadReport<M> = {
  loading: () => void
  loaded: (module: M) => void
  failed: (failure: WorldFailure) => void
}

export type WorldLoader = {
  /** Starts the import once; later calls, also after a failure, do nothing. */
  load: () => void
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/** One import per page load, whichever path asks first: the preload or the Visitor's entry. */
export function createWorldLoader<M>(
  importWorld: () => Promise<M>,
  report: LoadReport<M>,
): WorldLoader {
  let started = false
  return {
    load() {
      if (started) return
      started = true
      report.loading()
      importWorld().then(
        (module) => {
          report.loaded(module)
        },
        (reason: unknown) => {
          report.failed({ kind: 'bundle', message: messageOf(reason) })
        },
      )
    },
  }
}

/** The host's scheduling functions; `window` fits (WebKit has no requestIdleCallback, probed on #29). */
export type IdleHost = {
  requestIdleCallback?: (callback: () => void) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (handle: number) => void
}

/** Schedules `callback` for an idle moment and returns its cancel function. */
export function idleScheduler(host: IdleHost): (callback: () => void) => () => void {
  const { requestIdleCallback, cancelIdleCallback } = host
  if (requestIdleCallback !== undefined && cancelIdleCallback !== undefined) {
    return (callback) => {
      const handle = requestIdleCallback.call(host, callback)
      return () => {
        cancelIdleCallback.call(host, handle)
      }
    }
  }
  return (callback) => {
    const handle = host.setTimeout.call(host, callback, 0)
    return () => {
      host.clearTimeout.call(host, handle)
    }
  }
}

/** The Visitor entered before any import started: load now (no preload on a coarse pointer). */
export function shouldLoadOnEntry(state: AppState): boolean {
  return state.entering && state.worldStatus === 'idle'
}
