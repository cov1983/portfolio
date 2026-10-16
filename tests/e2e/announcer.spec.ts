import { CAPTION_MS } from '../../src/app/caption'
import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { ZONE_ENTRY_BUDGET_S } from '../journey'
import {
  CAPTION_SELECTOR,
  caption,
  captionWithin,
  entered,
  expect,
  firstExhibit,
  hydrated,
  recorded,
  test,
  titleScreen,
  worldContainer,
} from './fixtures'

// Seam 1, the Announcer (spec US-13, US-18; plan §5 and §6, corrected by #32): the caption is one
// role="status" element in the World overlay with the Content's text for its place, shown while
// the World is shown, for about 5 s. Text and wiring only, never WebGL output. The 5 s are
// controlled with page.clock while the Puck rests at the Hub's Reset point with no key held; the
// drive into the Zone is bounded in model time (ZONE_ENTRY_BUDGET_S, proven in goal.test.ts).

test('the caption is HTML text in a status element inside the World overlay, not in the canvas (AC-18.2)', async ({
  page,
}) => {
  await entered(page)
  await expect(caption(page)).toHaveCount(1)
  await expect(caption(page)).not.toHaveText('')
  const placed = await caption(page).evaluate((element) => ({
    inCanvas: element.closest('canvas') !== null,
    inOverlay: element.closest('section[aria-label="World"] .world-overlay') !== null,
  }))
  expect(placed).toEqual({ inCanvas: false, inOverlay: true })
})

test('the welcome arrives after the World leaves inert, so a screen reader announces it (AC-18.2)', async ({
  page,
  content,
}) => {
  await hydrated(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  // Each MutationObserver callback is one batch of DOM changes: the batch that drops `inert` from
  // the World section and the batch that puts text into the caption are numbered as they come.
  await page.evaluate((selector) => {
    const section = document.querySelector('section[aria-label="World"]')
    if (section === null) throw new Error('no World section')
    const seen: { inertRemoved?: number; textInserted?: number } = {}
    Object.assign(window, { __captionOrder: seen })
    let batch = 0
    new MutationObserver((records) => {
      batch += 1
      for (const record of records) {
        if (record.attributeName === 'inert' && !section.hasAttribute('inert'))
          seen.inertRemoved ??= batch
        if (
          record.type === 'childList' &&
          record.target instanceof Element &&
          record.target.matches(selector) &&
          record.target.textContent !== ''
        )
          seen.textInserted ??= batch
      }
    }).observe(section, {
      attributes: true,
      attributeFilter: ['inert'],
      childList: true,
      subtree: true,
    })
  }, CAPTION_SELECTOR)
  await page.keyboard.press('Enter')
  await expect(caption(page)).toHaveText(content.captions.hub)
  const order = await page.evaluate(
    () =>
      (window as unknown as { __captionOrder: { inertRemoved?: number; textInserted?: number } })
        .__captionOrder,
  )
  expect(order.inertRemoved, 'the batch that removed inert').toBeDefined()
  expect(order.textInserted ?? 0, 'the caption text in a later batch').toBeGreaterThan(
    order.inertRemoved ?? Infinity,
  )
})

test('the first entry into the Zone shows the Zone’s caption, one caption element at a time (AC-13.1, 18.1)', async ({
  page,
  content,
}) => {
  // Harness time for a software renderer, not the claim's bound: that is ZONE_ENTRY_BUDGET_S.
  test.setTimeout(120_000)
  const zoneCaption = content.captions.zones[firstExhibit(content).id]
  if (zoneCaption === undefined) throw new Error('the first Exhibit has no Zone caption')
  await entered(page)
  await expect(caption(page)).toHaveCount(1)
  await page.keyboard.down('ArrowUp')
  const seen = await captionWithin(page, ZONE_ENTRY_BUDGET_S, zoneCaption)
  await page.keyboard.up('ArrowUp')
  expect(seen, 'the Zone’s caption within the model-time budget, alone').toEqual({
    text: zoneCaption,
    count: 1,
    withinBound: true,
  })
})

/**
 * How long a "gone" read may wait for React to commit the expiry the fake clock fired: well under
 * CAPTION_MS of real time, so a real 5 s timer can never satisfy it (the default 5 s expect
 * timeout could, review of #57).
 */
const GONE_WITHIN_MS = 1000
/**
 * Fake time that delivers the frame after which World hands the caption its text (the paused
 * clock holds requestAnimationFrame too): one 16 ms frame with room. Counted against CAPTION_MS,
 * which runs from the commit that shows the World.
 */
const FRAME_MS = 20

test.describe('about 5 s on show (spec, storytelling)', () => {
  // The real clock until the World is ready (page.clock's fake performance records no user-timing
  // marks), then a paused fake one: the Puck rests at the Hub's Reset point, no key is held, and
  // only fastForward moves time on (a jump: one frame, the due timers once).
  test.beforeEach(async ({ page }) => {
    await hydrated(page)
    await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
    await page.clock.install()
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  })

  test('the welcome disappears once CAPTION_MS have passed in the World, not before', async ({
    page,
    content,
  }) => {
    await page.keyboard.press('Enter')
    await expect(worldContainer(page)).toBeVisible()
    await page.clock.runFor(FRAME_MS)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(CAPTION_MS - FRAME_MS - 1)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(1)
    await expect(caption(page)).toHaveText('', { timeout: GONE_WITHIN_MS })
  })

  test('the welcome waits behind the Title Screen: its 5 s start on entry', async ({
    page,
    content,
  }) => {
    await page.clock.fastForward(CAPTION_MS)
    await page.keyboard.press('Enter')
    await expect(worldContainer(page)).toBeVisible()
    await page.clock.runFor(FRAME_MS)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(CAPTION_MS - FRAME_MS - 1)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(1)
    await expect(caption(page)).toHaveText('', { timeout: GONE_WITHIN_MS })
  })

  test('Escape and re-entry show the welcome again for the full 5 s (Owner, #32 Q2)', async ({
    page,
    content,
  }) => {
    await page.keyboard.press('Enter')
    await expect(worldContainer(page)).toBeVisible()
    await page.clock.runFor(FRAME_MS)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(CAPTION_MS - 1000)
    await page.keyboard.press('Escape')
    await expect(titleScreen(page)).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(worldContainer(page)).toBeVisible()
    await page.clock.runFor(FRAME_MS)
    await page.clock.fastForward(CAPTION_MS - FRAME_MS - 1)
    await expect(caption(page)).toHaveText(content.captions.hub)
    await page.clock.fastForward(1)
    await expect(caption(page)).toHaveText('', { timeout: GONE_WITHIN_MS })
  })
})
