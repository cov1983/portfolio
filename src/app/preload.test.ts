import { describe, expect, it } from 'vitest'

import { createWorldLoader, idleScheduler, shouldLoadOnEntry, type LoadReport } from './preload.ts'
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
  it('uses requestIdleCallback where the host has one', () => {
    const scheduled: (() => void)[] = []
    const cancelled: number[] = []
    const schedule = idleScheduler({
      requestIdleCallback: (callback) => scheduled.push(callback),
      cancelIdleCallback: (handle) => cancelled.push(handle),
      setTimeout: () => {
        throw new Error('setTimeout must not be used when requestIdleCallback exists')
      },
      clearTimeout: () => undefined,
    })
    let ran = 0
    const cancel = schedule(() => {
      ran += 1
    })
    scheduled[0]?.()
    expect(ran).toBe(1)
    cancel()
    expect(cancelled).toEqual([1])
  })

  it('falls back to a zero-delay timeout where the host has no requestIdleCallback (WebKit)', () => {
    const timeouts: { callback: () => void; delay: number }[] = []
    const cleared: number[] = []
    const schedule = idleScheduler({
      setTimeout: (callback, delay) => timeouts.push({ callback, delay }),
      clearTimeout: (handle) => cleared.push(handle),
    })
    let ran = 0
    const cancel = schedule(() => {
      ran += 1
    })
    expect(timeouts[0]?.delay).toBe(0)
    timeouts[0]?.callback()
    expect(ran).toBe(1)
    cancel()
    expect(cleared).toEqual([1])
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
