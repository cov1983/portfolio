import { expect, expectedResponseHeaders, test } from './fixtures'

// ADR 0012: one assertion concept, every header of vercel.json's `/(.*)` entry reaches the browser
// with its value on the root page served by `vite preview`.
test('the root page carries the response headers of vercel.json', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.headers()).toMatchObject(expectedResponseHeaders())
})
