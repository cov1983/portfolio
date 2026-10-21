import { describe, expect, it } from 'vitest'

import {
  checkLink,
  checkLinks,
  exitCode,
  externalLinks,
  formatLines,
  REQUEST_HEADERS,
  type ExternalLink,
  type FetchLike,
  type LinkSource,
  type Outcome,
} from './check.ts'

/** A content literal in the loader's shape: internal and external links mixed, one URL cited twice. */
const content: LinkSource = {
  exhibits: [
    {
      id: 'first',
      links: [
        { label: 'The other one', url: '/exhibits#second', external: false },
        { label: 'Repository', url: 'https://x.example/one', external: true },
      ],
    },
    {
      id: 'second',
      links: [
        { label: 'Same repository', url: 'https://x.example/one', external: true },
        { label: 'Docs', url: 'https://y.example/two', external: true },
        { label: 'Home', url: '/', external: false },
      ],
    },
  ],
}

const link = (url: string, exhibit = 'first', label = 'Repository'): ExternalLink => ({
  exhibit,
  label,
  url,
})

type Call = { url: string; init: RequestInit }

/** A fetch that answers each URL with a status, or rejects with the Error given; every call recorded. */
function stub(answer: (url: string) => number | Error): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = []
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init })
    const a = answer(url)
    return a instanceof Error ? Promise.reject(a) : Promise.resolve({ status: a })
  }
  return { fetch, calls }
}

const outcome = (
  ok: boolean,
  status: number | null,
  detail = '',
  url = 'https://x.example/one',
): Outcome => ({
  link: link(url),
  ok,
  status,
  detail,
})

describe('externalLinks', () => {
  it('returns every external link in content order with its Exhibit, duplicates kept', () => {
    expect(externalLinks(content)).toEqual([
      { exhibit: 'first', label: 'Repository', url: 'https://x.example/one' },
      { exhibit: 'second', label: 'Same repository', url: 'https://x.example/one' },
      { exhibit: 'second', label: 'Docs', url: 'https://y.example/two' },
    ])
  })

  it('leaves the internal routes out', () => {
    expect(externalLinks(content).map((l) => l.url)).not.toContain('/exhibits#second')
  })

  it('is empty for content without an external link', () => {
    expect(externalLinks({ exhibits: [{ id: 'only', links: [] }] })).toEqual([])
  })
})

describe('checkLink', () => {
  it('is ok on a 2xx final status', async () => {
    expect(await checkLink(link('https://x.example/one'), stub(() => 200).fetch)).toEqual(
      outcome(true, 200),
    )
    expect((await checkLink(link('https://x.example/one'), stub(() => 204).fetch)).ok).toBe(true)
  })

  it('fails on a 404, carrying the status', async () => {
    expect(await checkLink(link('https://x.example/one'), stub(() => 404).fetch)).toEqual(
      outcome(false, 404),
    )
  })

  it('fails on a final redirect status: only a followed chain ending in 2xx is ok', async () => {
    expect((await checkLink(link('https://x.example/one'), stub(() => 301).fetch)).ok).toBe(false)
  })

  it('fails on a thrown fetch with the message and its cause', async () => {
    const error = new Error('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND x.example') })
    expect(await checkLink(link('https://x.example/one'), stub(() => error).fetch)).toEqual(
      outcome(false, null, 'fetch failed (getaddrinfo ENOTFOUND x.example)'),
    )
  })

  it('fails on a thrown fetch without a cause with the message alone', async () => {
    const result = await checkLink(
      link('https://x.example/one'),
      stub(() => new Error('The operation was aborted due to timeout')).fetch,
    )
    expect(result.detail).toBe('The operation was aborted due to timeout')
  })

  it('asks with GET, follows redirects, sends the headers and a timeout signal', async () => {
    const { fetch, calls } = stub(() => 200)
    await checkLink(link('https://x.example/one'), fetch)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://x.example/one')
    expect(calls[0]?.init).toMatchObject({
      method: 'GET',
      redirect: 'follow',
      headers: REQUEST_HEADERS,
    })
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('cancels the response body once the status is read, so the connection is released', async () => {
    let cancelled = 0
    const fetch: FetchLike = () =>
      Promise.resolve({
        status: 200,
        body: {
          cancel: () => {
            cancelled += 1
            return Promise.resolve()
          },
        },
      })
    expect((await checkLink(link('https://x.example/one'), fetch)).ok).toBe(true)
    expect(cancelled).toBe(1)
  })

  it('keeps the status and reports a body cancel that rejects as the detail', async () => {
    const fetch: FetchLike = () =>
      Promise.resolve({
        status: 200,
        body: { cancel: () => Promise.reject(new Error('stream already errored')) },
      })
    expect(await checkLink(link('https://x.example/one'), fetch)).toEqual(
      outcome(true, 200, 'body not cancelled: stream already errored'),
    )
  })

  it('accepts an answer without a body (a 304, a stub)', async () => {
    const fetch: FetchLike = () => Promise.resolve({ status: 200, body: null })
    expect((await checkLink(link('https://x.example/one'), fetch)).ok).toBe(true)
  })
})

describe('checkLinks', () => {
  it('fetches every link once, in order, and keeps the outcomes in that order', async () => {
    const { fetch, calls } = stub((url) => (url.endsWith('two') ? 500 : 200))
    const outcomes = await checkLinks(externalLinks(content), fetch)
    expect(calls.map((c) => c.url)).toEqual([
      'https://x.example/one',
      'https://x.example/one',
      'https://y.example/two',
    ])
    expect(outcomes.map((o) => [o.link.exhibit, o.ok])).toEqual([
      ['first', true],
      ['second', true],
      ['second', false],
    ])
  })

  it('is empty without a link and calls nothing', async () => {
    const { fetch, calls } = stub(() => 200)
    expect(await checkLinks([], fetch)).toEqual([])
    expect(calls).toEqual([])
  })
})

describe('formatLines', () => {
  const ok = outcome(true, 200, '', 'https://x.example/one')
  const notFound: Outcome = {
    link: link('https://y.example/two', 'second', 'Workflow guide'),
    ok: false,
    status: 404,
    detail: '',
  }
  const thrown: Outcome = {
    link: link('https://z.example/three', 'second', 'Docs'),
    ok: false,
    status: null,
    detail: 'fetch failed (getaddrinfo ENOTFOUND z.example)',
  }

  it('prints verdict, status, Exhibit, label and URL in aligned columns', () => {
    expect(formatLines([ok, notFound])).toEqual([
      'ok    200  first   Repository      https://x.example/one',
      'FAIL  404  second  Workflow guide  https://y.example/two',
      '::error::link check: 1 of 2 external links failed',
      'links: 2 checked, 1 failed',
    ])
  })

  it('prints n/a and the detail for a thrown fetch', () => {
    expect(formatLines([thrown])[0]).toBe(
      'FAIL  n/a  second  Docs  https://z.example/three  (fetch failed (getaddrinfo ENOTFOUND z.example))',
    )
  })

  it('prints no annotation when every link is ok', () => {
    expect(formatLines([ok])).toEqual([
      'ok    200  first  Repository  https://x.example/one',
      'links: 1 checked, 0 failed',
    ])
  })

  it('prints the summary alone for content without an external link', () => {
    expect(formatLines([])).toEqual(['links: 0 checked, 0 failed'])
  })

  it('says "link" for a single failed link', () => {
    expect(formatLines([notFound])[1]).toBe('::error::link check: 1 of 1 external link failed')
  })
})

describe('exitCode', () => {
  it('is 0 when every link is ok', () => {
    expect(exitCode([outcome(true, 200)])).toBe(0)
  })

  it('is 0 without a link', () => {
    expect(exitCode([])).toBe(0)
  })

  it('is 1 on one failure among successes', () => {
    expect(exitCode([outcome(true, 200), outcome(false, 404)])).toBe(1)
  })
})
