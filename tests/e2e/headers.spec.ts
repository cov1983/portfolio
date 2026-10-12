import { expect, expectedResponseHeaders, test } from './fixtures'

// ADR 0012: one assertion concept, every header of vercel.json's `/(.*)` entry reaches the browser
// with its value on both pre-rendered documents served by `vite preview`.
for (const path of ['/', '/exhibits']) {
  test(`${path} carries the response headers of vercel.json`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.headers()).toMatchObject(expectedResponseHeaders())
  })
}
