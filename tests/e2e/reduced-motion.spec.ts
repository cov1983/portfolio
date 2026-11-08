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

  // increment-2 AC-1.2 (Owner, #103 comments 6723218035 and 6723304033): the caption's fade is gone,
  // so the caption is still without the preference too; AC-18.3 now holds by absence. Red: before
  // T0b removed it, this read `caption-in`. The reduce rule's own control is the headline reveal
  // below.
  test('appears without animation without the preference too (increment-2 AC-1.2)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await entered(page)
    expect((await captionMotion(page)).animation).toBe('none')
  })
})

// increment-2 AC-2.4 (plan §6 row 2.4): under reduced motion the headline reveal is instant, so
// nothing animates when the Title Screen appears. Without the preference the reveal is there,
// which is what makes the first two checks able to fail.
test.describe('the Title Screen appearing (increment-2 AC-2.4)', () => {
  const headlineAnimation = (page: Page): Promise<string> =>
    page.locator('.hero .headline').evaluate((element) => getComputedStyle(element).animationName)

  test('has no running animation at load under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    expect(await runningAnimations(page)).toEqual([])
  })

  test('shows the headline without its reveal under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    expect(await headlineAnimation(page)).toBe('none')
  })

  test('reveals the headline without the preference, so the checks above can fail', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    expect(await headlineAnimation(page)).toBe('headline-reveal')
  })
})

test('nothing animates after the caption, Reset, the Goal and the Panel under reduced motion (AC-25.1)', async ({
  page,
}) => {
  // Harness time for a software renderer, not the claim's bound: that is GOAL_BUDGET_S.
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await entered(page)
  await expect.poll(() => recorded(page, WORLD_PLAYABLE_MARK)).toBe(1)
  await expect(caption(page)).not.toHaveText('')
  expect(await runningAnimations(page), 'the caption').toEqual([])

  // The Reset, Goal and Panel checkpoints hold by absence today: nothing in the World animates or
  // transitions on these events (D8, plan §6 row 25.1; the caption's fade went in increment-2
  // T0b), so they would pass without the reduce rule as well. They guard against a future effect on these events, which must honour the preference;
  // its own no-preference control belongs here once it exists (ai-review on #57).
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(worldContainer(page)).toBeFocused()
  expect(await runningAnimations(page), 'the Reset control').toEqual([])
  await page.keyboard.press('KeyR')
  expect(await runningAnimations(page), 'Reset by R').toEqual([])

  // From rest at the Reset point into the Goal within its model-time budget (goal.test.ts), read
  // once right after the hold, as exhibit-panel.spec reads its re-entry: an auto-waiting read
  // would let the gliding Puck score after the bound and pass.
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
