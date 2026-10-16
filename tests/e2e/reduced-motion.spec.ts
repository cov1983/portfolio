import type { Page } from '@playwright/test'

import { WORLD_PLAYABLE_MARK } from '../../src/perf/marks'
import { GOAL_BUDGET_S } from '../journey'
import {
  caption,
  entered,
  exhibitPanel,
  expect,
  modelTime,
  recorded,
  test,
  titleScreen,
  worldContainer,
} from './fixtures'

// Seam 1, reduced motion (spec US-18, US-25; plan §6 rows 18.3 and 25.1, corrected by #32): with
// prefers-reduced-motion the caption appears without animation, and no element animates or
// transitions on any event of increment-1. Screen shake and a scoring celebration do not exist;
// the Follow Camera's snap is the unit proof of AC-11.3 (src/world/model/camera.test.ts). Computed
// styles and the document's animations only, never WebGL output.

/** The names of the page's running CSS animations and transitions, none expected under reduce. */
function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) =>
        animation instanceof CSSAnimation
          ? animation.animationName
          : animation instanceof CSSTransition
            ? animation.transitionProperty
            : 'script animation',
      ),
  )
}

/** The shown caption's text element: what fades in, and what reduced motion keeps still. */
async function captionMotion(page: Page): Promise<{ animation: string; transition: string }> {
  return caption(page)
    .locator('span')
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return { animation: style.animationName, transition: style.transitionDuration }
    })
}

test.describe('the caption (AC-18.3)', () => {
  test('appears without animation or transition under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await entered(page)
    expect(await captionMotion(page)).toEqual({ animation: 'none', transition: '0s' })
  })

  test('fades in without the preference, so the check above can fail', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await entered(page)
    expect((await captionMotion(page)).animation).toBe('caption-in')
  })
})

test('nothing animates after the caption, Reset, the Goal and the Panel under reduced motion (AC-25.1)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await entered(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  await expect(caption(page)).not.toHaveText('')
  expect(await runningAnimations(page), 'the caption').toEqual([])

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(worldContainer(page)).toBeFocused()
  expect(await runningAnimations(page), 'the Reset control').toEqual([])
  await page.keyboard.press('KeyR')
  expect(await runningAnimations(page), 'Reset by R').toEqual([])

  // From rest at the Reset point into the Goal within its model-time budget (goal.test.ts).
  await page.keyboard.down('ArrowUp')
  await modelTime(page, GOAL_BUDGET_S)
  await page.keyboard.up('ArrowUp')
  expect(await exhibitPanel(page).isVisible(), 'the Goal within GOAL_BUDGET_S').toBe(true)
  expect(await runningAnimations(page), 'the Goal and the Panel opening').toEqual([])
  // No caption over the open Panel (Owner's decision on #32: the Goal's half of the caption rule).
  expect(await caption(page).textContent(), 'the caption under the open Panel').toBe('')

  await page.keyboard.press('Escape')
  await expect(exhibitPanel(page)).toHaveCount(0)
  await expect(worldContainer(page)).toBeVisible()
  await expect(titleScreen(page)).toBeHidden()
  expect(await runningAnimations(page), 'the Panel closing').toEqual([])
})
