import { describe, expect, it } from 'vitest'

import {
  createWorldLoader,
  idleScheduler,
  shouldLoadOnEntry,
  shouldPreload,
  type LoadReport,
} from './preload.ts'
import { INITIAL_STATE, type AppState } from './store.ts'

type Module = { World: string }

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Call = ['loading'] | ['loaded', Module] | ['failed', { kind: string; message: string }]

function recorder(): { calls: Call[]; report: LoadReport<Module> } {
  const calls: Call[] = []
  return {
    calls,
    report: {
      loading: () => calls.push(['loading']),
      loaded: (module) => calls.push(['loaded', module]),
      failed: (failure) => calls.push(['failed', failure]),
    },
  }
}

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...INITIAL_STATE, ...overrides }
}

describe('createWorldLoader', () => {
  it('imports the World once, however often load is called (the preload and the entry share one import)', async () => {
    let imports = 0
    const { calls, report } = recorder()
    const loader = createWorldLoader(() => {
      imports += 1
      return Promise.resolve({ World: 'the World' })
    }, report)
    loader.load()
    loader.load()
    await Promise.resolve()
    loader.load()
    expect(imports).toBe(1)
    expect(calls.filter(([kind]) => kind === 'loading')).toHaveLength(1)
  })

  it('reports loading before the import resolves and loaded with the module afterwards', async () => {
    const chunk = deferred<Module>()
    const { calls, report } = recorder()
    createWorldLoader(() => chunk.promise, report).load()
    expect(calls).toEqual([['loading']])
    chunk.resolve({ World: 'the World' })
    await chunk.promise
    expect(calls).toEqual([['loading'], ['loaded', { World: 'the World' }]])
  })

  it('reports a bundle failure with the error message when the import rejects', async () => {
    const chunk = deferred<Module>()
    const { calls, report } = recorder()
    createWorldLoader(() => chunk.promise, report).load()
    chunk.reject(new Error('Failed to fetch dynamically imported module'))
    await chunk.promise.catch(() => undefined)
    expect(calls).toEqual([
      ['loading'],
      ['failed', { kind: 'bundle', message: 'Failed to fetch dynamically imported module' }],
    ])
  })

  it('stringifies a rejection that is not an Error', async () => {
    const chunk = deferred<Module>()
    const { calls, report } = recorder()
    createWorldLoader(() => chunk.promise, report).load()
    chunk.reject('offline') // a non-Error reason, as a thrown string would be
    await chunk.promise.catch(() => undefined)
    expect(calls[1]).toEqual(['failed', { kind: 'bundle', message: 'offline' }])
  })

  it('does not retry a failed import on a later load (the failure UI is T8b’s)', async () => {
    let imports = 0
    const { calls, report } = recorder()
    const loader = createWorldLoader(() => {
      imports += 1
      return Promise.reject(new Error('no'))
    }, report)
    loader.load()
    await Promise.resolve()
    await Promise.resolve()
    loader.load()
    expect(imports).toBe(1)
    expect(calls.filter(([kind]) => kind === 'failed')).toHaveLength(1)
  })
})

describe('idleScheduler', () => {
  function idleHost() {
    const scheduled: (() => void)[] = []
    const cancelled: number[] = []
    const host = {
      requestIdleCallback: (callback: () => void) => scheduled.push(callback),
      cancelIdleCallback: (handle: number) => cancelled.push(handle),
      setTimeout: () => {
        throw new Error('setTimeout must not be used when requestIdleCallback exists')
      },
      clearTimeout: () => undefined,
    }
    return { host, scheduled, cancelled }
  }

  function timeoutHost() {
    const timeouts: { callback: () => void; delay: number }[] = []
    const cleared: number[] = []
    const host = {
      setTimeout: (callback: () => void, delay: number) => timeouts.push({ callback, delay }),
      clearTimeout: (handle: number) => cleared.push(handle),
    }
    return { host, timeouts, cleared }
  }

  it('runs the callback through requestIdleCallback where the host has one', () => {
    const { host, scheduled } = idleHost()
    let ran = 0
    idleScheduler(host)(() => {
      ran += 1
    })
    scheduled[0]?.()
    expect(ran).toBe(1)
  })

  it('cancels an idle callback through cancelIdleCallback', () => {
    const { host, cancelled } = idleHost()
    idleScheduler(host)(() => undefined)()
    expect(cancelled).toEqual([1])
  })

  it('falls back to a zero-delay timeout where the host has no requestIdleCallback (WebKit)', () => {
    const { host, timeouts } = timeoutHost()
    let ran = 0
    idleScheduler(host)(() => {
      ran += 1
    })
    expect(timeouts[0]?.delay).toBe(0)
    timeouts[0]?.callback()
    expect(ran).toBe(1)
  })

  it('cancels the fallback timeout', () => {
    const { host, cleared } = timeoutHost()
    idleScheduler(host)(() => undefined)()
    expect(cleared).toEqual([1])
  })
})

describe('shouldPreload', () => {
  it('preloads on a fine pointer while nothing has been imported', () => {
    expect(shouldPreload(state({ capability: { coarsePointer: false } }))).toBe(true)
  })

  it('does not preload before the capability is known or on a coarse pointer', () => {
    expect(shouldPreload(state())).toBe(false)
    expect(shouldPreload(state({ capability: { coarsePointer: true } }))).toBe(false)
  })

  it('does not preload twice: an import under way, done or failed is left alone', () => {
    const fine = { coarsePointer: false }
    expect(shouldPreload(state({ capability: fine, worldStatus: 'loading' }))).toBe(false)
    expect(shouldPreload(state({ capability: fine, worldStatus: 'ready' }))).toBe(false)
    expect(shouldPreload(state({ capability: fine, worldStatus: 'failed' }))).toBe(false)
  })
})

describe('shouldLoadOnEntry', () => {
  it('loads when the Visitor enters before any import started (the coarse-pointer path)', () => {
    expect(shouldLoadOnEntry(state({ entering: true }))).toBe(true)
  })

  it('does nothing while an import is under way, done or failed', () => {
    expect(shouldLoadOnEntry(state({ entering: true, worldStatus: 'loading' }))).toBe(false)
    expect(shouldLoadOnEntry(state({ entering: true, worldStatus: 'ready' }))).toBe(false)
    expect(shouldLoadOnEntry(state({ entering: true, worldStatus: 'failed' }))).toBe(false)
  })

  it('does nothing before the Visitor enters', () => {
    expect(shouldLoadOnEntry(state())).toBe(false)
  })
})
