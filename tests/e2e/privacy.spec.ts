import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { GOAL_BUDGET_S } from '../journey'
import {
  entered,
  exhibitPanel,
  expect,
  firstExhibit,
  hydrated,
  listEntry,
  modelTime,
  opened,
  recorded,
  test,
  textOf,
  titleScreen,
  WORLD_CHUNK,
  worldContainer,
} from './fixtures'

// US-20 (spec: Fallback Page): the Contact on both pre-rendered documents, the e-mail address
// obfuscated against scraping, the GitHub profile in a new tab, the Bio on the Fallback Page only.
const PAGES = ['/', '/exhibits']

function decodeDecimalReferences(text: string): string {
  return text.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

test('neither document’s source contains a plain mailto: (AC-20.1)', async ({ request }) => {
  for (const path of PAGES) {
    const html = await (await request.get(path)).text()
    expect(html, path).not.toContain('mailto:')
  }
})

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of PAGES) {
    test(`${path}: the e-mail link opens the mail client with the Owner’s address (AC-20.1)`, async ({
      page,
      content,
    }) => {
      await page.goto(path)
      const link = page.locator('a[href^="mailto:"]')
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute(
        'href',
        decodeDecimalReferences(content.contact.emailHrefEntities),
      )
    })

    test(`${path}: the GitHub link opens the Owner’s profile in a new tab (AC-20.2)`, async ({
      page,
      content,
    }) => {
      await page.goto(path)
      const link = page.getByRole('link', { name: 'GitHub' })
      await expect(link).toHaveAttribute('href', content.contact.github)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/)
    })
  }

  test('the Contact is on both pages, the one line on the Title Screen, the Bio on the Fallback Page only (AC-20.3)', async ({
    page,
    content,
  }) => {
    const bio = textOf(content.bioHtml).slice(0, 40)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(content.oneLine)).toBeVisible()
    await expect(page.getByText(bio)).toHaveCount(0)
    await page.goto('/exhibits')
    await expect(page.getByRole('link', { name: 'E-mail' })).toHaveCount(1)
    await expect(page.getByText(bio)).toHaveCount(1)
  })
})

// US-17 (spec: Exhibit Panel): Exhibit media cost nothing until a Panel opens (AC-17.1), and in the
// Panel the images come from the site's origin at a size for the viewport (AC-17.3). The video's
// markup is proven on the build seam (tests/build/content-build.test.ts, AC-17.2); its browser
// half waits for the first Exhibit with a video (#52).
const EXHIBIT_MEDIA = '/media/exhibits/'

/** Every request URL from now on, in the order the page made them. */
function requestLog(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    urls.push(request.url())
  })
  return urls
}

test.describe('Exhibit media', () => {
  test('nothing under /media/exhibits/ is requested before a Panel opens, the World loaded included (AC-17.1)', async ({
    page,
  }) => {
    const urls = requestLog(page)
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    expect(urls.filter((url) => new URL(url).pathname.startsWith(EXHIBIT_MEDIA))).toEqual([])
  })

  test('opening a Panel requests its media, so the log above would see them', async ({
    page,
    content,
  }) => {
    const urls = requestLog(page)
    await hydrated(page)
    await listEntry(page, firstExhibit(content).title).click()
    await expect
      .poll(() => urls.some((url) => new URL(url).pathname.startsWith(EXHIBIT_MEDIA)))
      .toBe(true)
  })

  test('each picture source in the Panel is same-origin, with three widths and sizes (AC-17.3)', async ({
    page,
    content,
  }) => {
    const exhibit = firstExhibit(content)
    await opened(page, exhibit.title)
    const sources = exhibitPanel(page).locator('picture source')
    await expect(sources).toHaveCount(exhibit.images.length * 2)
    const read = await sources.evaluateAll((elements) =>
      elements.map((element) => ({
        srcset: element.getAttribute('srcset') ?? '',
        sizes: element.getAttribute('sizes') ?? '',
      })),
    )
    for (const { srcset, sizes } of read) {
      const candidates = srcset.split(',').map((candidate) => candidate.trim().split(/\s+/))
      expect(candidates.map(([, width]) => width)).toEqual([
        expect.stringMatching(/^\d+w$/),
        expect.stringMatching(/^\d+w$/),
        expect.stringMatching(/^\d+w$/),
      ])
      for (const [url] of candidates) {
        expect(new URL(url ?? '', page.url()).origin).toBe(new URL(page.url()).origin)
      }
      expect(sizes).not.toBe('')
    }
  })

  test('each image fallback in the Panel is same-origin (AC-17.3)', async ({ page, content }) => {
    await opened(page, firstExhibit(content).title)
    const sources = await exhibitPanel(page)
      .locator('picture img')
      .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
    expect(sources).not.toEqual([])
    for (const source of sources) {
      expect(new URL(source).origin).toBe(new URL(page.url()).origin)
    }
  })
})

// US-28 (spec: Privacy, AC-28.1–28.3; plan §6 rows 28.1–28.3; T9 #34): nothing behind the
// Visitor's back over a full visit, Title Screen, Enter, World, Goal, Panel, Escape, Fallback Page.
// One journey with labelled sections (Owner on #31: the drive is the slow part under software
// rendering), bounded by GOAL_BUDGET_S of model time; the two cases after it prove the counter and
// the inspection can fail. Presence, requests and stores only, never WebGL output.
//
// Probe of 2026-10-21 against the installed Playwright 1.64 engines (#34, step 1a), folded in here:
// - The request listener and the page's resource timing agree in Chromium and WebKit. Firefox
//   fetches /favicon.ico on its own: resource timing records it (initiator "other"), the listener
//   and the response event never see it. The log is therefore the union of both sources, read per
//   document before it is left (resource timing, marks and the DOM are per document).
// - blob:, data: and about: URLs are document-local and excluded from the origin check (Owner's
//   amendment); the visit produced 0 / 0 / 0 of them in all three engines.
// - webkitAudioContext is absent in all three engines, WebKit 2370 included: the counter wraps the
//   constructors an engine has and skips the rest. One construction of AudioContext,
//   OfflineAudioContext and Audio recorded one mark each in all three.
// - document.createElement('audio') outside the DOM is not counted (accepted gap, Owner on #34):
//   such an element that plays still makes a media request, which the log catches.
// - Firefox answers a cached stylesheet on /exhibits with 304 and no content-type: a missing or
//   empty content-type is not audio.
// - A request sent while / unloads (a beacon or a keepalive fetch on pagehide) is seen by the
//   listener alone: /'s resource timing is read before the navigation. The backstop is the CSP's
//   `connect-src 'self'`, whose violation the shared fixture turns into a failure (ai-review on
//   #73, finding 1).
// - navigator.serviceWorker is present in all three engines on the served site (probe of
//   2026-10-21 from the journey itself), so the registration count under AC-28.2 is a real check
//   in each; the `in navigator` guard stays for an engine that drops the API on plain http
//   (ai-review on #73, second pass, C).

/** The user-timing mark the init script records once per audio constructor call. */
const AUDIO_CONSTRUCTED_MARK = 'audio-constructed'
/** The mark the init script records should the resource-timing buffer overflow (A2). */
const BUFFER_FULL_MARK = 'resource-timing-buffer-full'
/** Enough for the visit's handful of entries; the journey asserts the buffer never filled. */
const RESOURCE_TIMING_BUFFER = 2000
/** Constructors whose construction plays or prepares audio; wrapped where the engine has them. */
const AUDIO_CONSTRUCTORS = ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'Audio']
/** Document-local URLs: never a request to an origin (Owner's amendment on #34). */
const DOCUMENT_LOCAL_SCHEMES = ['blob:', 'data:', 'about:']

/**
 * Before any page script: the resource-timing buffer with its overflow mark, and the audio counter.
 * Each constructor the engine has is replaced by a Proxy whose construct trap records the mark and
 * builds the original, so `instanceof` and three's `new (window.AudioContext ||
 * window.webkitAudioContext)()` path both go through it. The count is read as a mark, through
 * `recorded`: no window global beyond the fixture's binding (plan §6).
 */
async function withPrivacyInstruments(page: Page): Promise<void> {
  await page.addInitScript(
    ({ constructors, audioMark, bufferMark, buffer }) => {
      performance.setResourceTimingBufferSize(buffer)
      performance.addEventListener('resourcetimingbufferfull', () => {
        performance.mark(bufferMark)
      })
      const globals = window as unknown as Record<string, unknown>
      for (const name of constructors) {
        const original = globals[name]
        if (typeof original !== 'function') continue
        globals[name] = new Proxy(original, {
          construct(target, args: unknown[], newTarget) {
            performance.mark(audioMark)
            return Reflect.construct(target, args, newTarget) as object
          },
        })
      }
    },
    {
      constructors: AUDIO_CONSTRUCTORS,
      audioMark: AUDIO_CONSTRUCTED_MARK,
      bufferMark: BUFFER_FULL_MARK,
      buffer: RESOURCE_TIMING_BUFFER,
    },
  )
}

/** `error` is Playwright's failure text on a `failed` entry (ai-review on #73, second pass, A). */
type RequestSeen = { url: string; type: string; error?: string }
type ResponseSeen = { url: string; contentType: string }
/** Every request and response from now on, as Playwright sees them (installed before any navigation). */
type Visit = { requests: RequestSeen[]; responses: ResponseSeen[] }

function watched(page: Page): Visit {
  const visit: Visit = { requests: [], responses: [] }
  page.on('request', (request) => {
    visit.requests.push({ url: request.url(), type: request.resourceType() })
  })
  // A failed request is still a request to an origin: logged a second time under its own type,
  // after the `request` event every request fires first, so the journey can assert that none
  // failed (a silently failing same-origin request is a wiring bug; ai-review on #73, finding 5).
  page.on('requestfailed', (request) => {
    visit.requests.push({
      url: request.url(),
      type: 'failed',
      error: request.failure()?.errorText ?? '',
    })
  })
  page.on('response', (response) => {
    visit.responses.push({
      url: response.url(),
      contentType: response.headers()['content-type'] ?? '',
    })
  })
  return visit
}

/** What one document shows before it is left: its resource-timing names, its stores, its marks and audio elements. */
type Observed = {
  resources: string[]
  cookie: string
  local: number
  session: number
  databases: number
  caches: number
  /** Service worker registrations: persistent state too (ai-review on #73, finding 2). */
  workers: number
  audioConstructed: number
  bufferFull: number
  audioElements: number
}

function observed(page: Page): Promise<Observed> {
  return page.evaluate(
    async ({ audioMark, bufferMark }) => ({
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
      cookie: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      workers:
        'serviceWorker' in navigator
          ? (await navigator.serviceWorker.getRegistrations()).length
          : 0,
      audioConstructed: performance.getEntriesByName(audioMark, 'mark').length,
      bufferFull: performance.getEntriesByName(bufferMark, 'mark').length,
      audioElements: document.querySelectorAll('audio').length,
    }),
    { audioMark: AUDIO_CONSTRUCTED_MARK, bufferMark: BUFFER_FULL_MARK },
  )
}

/** The stores AC-28.2 names, plus the Cache API and service worker registrations ("any storage", the ticket). */
function stores(
  seen: Observed,
): Pick<Observed, 'cookie' | 'local' | 'session' | 'databases' | 'caches' | 'workers'> {
  const { cookie, local, session, databases, caches, workers } = seen
  return { cookie, local, session, databases, caches, workers }
}

const EMPTY_STORES = { cookie: '', local: 0, session: 0, databases: 0, caches: 0, workers: 0 }

/** The URLs that went to another origin; document-local schemes are no request at all. */
function offOrigin(urls: string[], origin: string): string[] {
  return urls
    .filter((url) => !DOCUMENT_LOCAL_SCHEMES.some((scheme) => url.startsWith(scheme)))
    .filter((url) => new URL(url).origin !== origin)
}

/** An audio response by its content type; absent or empty (a 304) is not audio. */
function isAudio(contentType: string): boolean {
  return contentType.trim().toLowerCase().startsWith('audio/')
}

test.describe('a full visit (US-28)', () => {
  test('sends every request to the site, stores nothing and plays no audio (AC-28.1, 28.2, 28.3)', async ({
    page,
    context,
    baseURL,
  }) => {
    // Harness time for a software renderer; the claim's bound is GOAL_BUDGET_S of model time.
    test.setTimeout(240_000)
    if (baseURL === undefined) throw new Error('the project has no baseURL')
    const origin = new URL(baseURL).origin
    const visit = watched(page)
    await withPrivacyInstruments(page)

    // Title Screen, Enter, the World playable, the Reset control, then from rest at the Reset
    // point into the Goal within its model-time budget, read once right after the hold (an
    // auto-waiting read would let the gliding Puck score after the bound and pass).
    await entered(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(worldContainer(page)).toBeFocused()
    await page.keyboard.down('ArrowUp')
    await modelTime(page, GOAL_BUDGET_S)
    await page.keyboard.up('ArrowUp')
    expect(await exhibitPanel(page).isVisible(), 'the Goal within GOAL_BUDGET_S').toBe(true)

    // The Panel over the paused World, every image of it that started loading loaded before it
    // unmounts (an image still in flight when the Panel leaves is aborted, which the engine reports
    // as a failed request; ai-review on #73, second pass, A). An img with an empty currentSrc has
    // not started (Picture.tsx loads lazily) and is never waited on: the poll assumes the Panel's
    // images are in view (ai-review on #73, third pass, 1; #74). Escape back into the World;
    // Escape to the Title Screen.
    await expect
      .poll(() =>
        exhibitPanel(page)
          .locator('img')
          .evaluateAll((images) =>
            images.every((image) => {
              const { complete, currentSrc } = image as HTMLImageElement
              return complete || currentSrc === ''
            }),
          ),
      )
      .toBe(true)
    await page.keyboard.press('Escape')
    await expect(exhibitPanel(page)).toHaveCount(0)
    await expect(worldContainer(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    const onRoot = await observed(page)
    await page.goto('/exhibits')
    const onFallback = await observed(page)

    // (a) AC-28.1: the union of the listener and both documents' resource timing. Not vacuous: the
    // log holds the World chunk, the Panel's media and the Fallback Page document.
    const urls = [...visit.requests.map((r) => r.url), ...onRoot.resources, ...onFallback.resources]
    expect(onRoot.resources.length, 'resource timing on /').toBeGreaterThan(0)
    expect(onFallback.resources.length, 'resource timing on /exhibits').toBeGreaterThan(0)
    expect(onRoot.bufferFull + onFallback.bufferFull, 'the resource-timing buffer overflowed').toBe(
      0,
    )
    const pathnames = urls.map((url) => new URL(url).pathname)
    expect(
      urls.some((url) => WORLD_CHUNK.test(url)),
      'the World chunk in the log',
    ).toBe(true)
    expect(
      pathnames.some((pathname) => pathname.startsWith(EXHIBIT_MEDIA)),
      'the Panel’s media in the log',
    ).toBe(true)
    expect(pathnames.includes('/exhibits'), 'the Fallback Page document in the log').toBe(true)
    expect(offOrigin(urls, origin), 'requests off the site’s origin').toEqual([])
    expect(
      visit.requests.filter((r) => r.type === 'failed').map((r) => `${r.url} (${r.error ?? ''})`),
      'requests that failed during the visit, with the engine’s failure text',
    ).toEqual([])

    // (b) AC-28.2: every store empty on both documents, and from outside the page (HttpOnly cookies
    // document.cookie cannot see; any origin with storage).
    expect(stores(onRoot), 'the stores on /').toEqual(EMPTY_STORES)
    expect(stores(onFallback), 'the stores on /exhibits').toEqual(EMPTY_STORES)
    expect(await context.cookies(), 'cookies the browser holds').toEqual([])
    expect((await context.storageState()).origins, 'origins with storage').toEqual([])

    // (c) AC-28.3: no audio constructed on /, no audio element on either document, no media request,
    // no audio response. /exhibits carries no script (T4's build proof), so its marks are moot.
    expect(onRoot.audioConstructed, 'audio constructed on /').toBe(0)
    expect([onRoot.audioElements, onFallback.audioElements], 'audio elements').toEqual([0, 0])
    expect(
      visit.requests.filter((r) => r.type === 'media').map((r) => r.url),
      'media requests',
    ).toEqual([])
    expect(
      visit.responses.filter((r) => isAudio(r.contentType)).map((r) => r.url),
      'audio responses',
    ).toEqual([])
  })

  test('the counter counts: an AudioContext, an OfflineAudioContext and an Audio constructed from the page read as 3', async ({
    page,
  }) => {
    await withPrivacyInstruments(page)
    await hydrated(page)
    // Without a gesture an AudioContext constructs suspended in all three engines; closed at once.
    await page.evaluate(async () => {
      const audioContext = new AudioContext()
      await audioContext.close()
      new OfflineAudioContext(1, 1, 44_100)
      new Audio()
    })
    expect(await recorded(page, AUDIO_CONSTRUCTED_MARK)).toBe(3)
  })

  test('the inspection sees a value the test writes to localStorage, so the empty report above means something', async ({
    page,
  }) => {
    await hydrated(page)
    await page.evaluate(() => {
      localStorage.setItem('privacy-spec', 'written by the test')
    })
    expect(stores(await observed(page)).local).toBe(1)
  })
})
