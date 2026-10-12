import { expect, test } from './fixtures'

// Seam 1 at `/exhibits`: the pre-rendered Fallback Page (spec: Fallback Page; ADR 0004, ADR 0010).
// The first case is plan §2's verification that the clean URL serves exhibits/index.html.
test('the preview serves the Fallback Page at /exhibits', async ({ page, content }) => {
  await page.goto('/exhibits')
  await expect(page).toHaveTitle(`Exhibits — ${content.owner.name}`)
})
