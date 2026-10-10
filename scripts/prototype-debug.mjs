import { chromium } from '@playwright/test'
import { preview } from 'vite'
const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'error' })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const page = await browser.newPage()
page.on('console', (m) => console.log('console', m.type(), m.text()))
page.on('pageerror', (e) => console.log('pageerror', e.message, e.stack))
page.on('requestfailed', (r) => console.log('requestfailed', r.url(), r.failure()?.errorText))
await page.goto('http://localhost:4174/')
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000)
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').map((m) => `${m.name}@${Math.round(m.startTime)}`))
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length)
  console.log(`t=${i + 1}s marks=${marks.join(',')} canvases=${canvases}`)
  if (marks.length >= 2) break
}
await browser.close()
await server.close()
