import { expect, expectedResponseHeaders, test, type Problem, type ProblemKind } from './fixtures'

// The shared fixture's passing-and-failing proof in every browser (plan §6: a page error, a console
// error or a CSP violation fails the test). Three cases make the page report one problem each and
// check that the fixture recorded it; the last case records a problem directly and is declared an
// expected failure, so Playwright goes red the day the fixture stops failing the test.

/** Waits until the fixture recorded a problem of `kind` mentioning `detail`, then consumes that entry alone. */
async function expectRecorded(
  problems: Problem[],
  kind: ProblemKind,
  detail: string,
): Promise<void> {
  const matches = (p: Problem): boolean => p.kind === kind && p.detail.includes(detail)
  await expect.poll(() => problems.some(matches)).toBe(true)
  problems.splice(problems.findIndex(matches), 1)
}

function throwLater(): void {
  setTimeout(() => {
    throw new Error('synthetic page error')
  }, 0)
}

test.describe('the shared fixture', () => {
  test('records an uncaught page error', async ({ page, problems }) => {
    await page.goto('/')
    await page.evaluate(throwLater)
    await expectRecorded(problems, 'pageerror', 'synthetic page error')
  })

  test('records a console error', async ({ page, problems }) => {
    await page.goto('/')
    await page.evaluate(() => {
      console.error('synthetic console error')
    })
    await expectRecorded(problems, 'console.error', 'synthetic console error')
  })

  test('records a Content Security Policy violation', async ({ page, problems }) => {
    // A synthetic page under the site's own policy whose inline script the CSP blocks.
    await page.route('**/synthetic-inline-script', (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: {
          'content-security-policy': expectedResponseHeaders()['content-security-policy'] ?? '',
        },
        body: '<!doctype html><title>synthetic</title><script>document.title = "ran"</script>',
      }),
    )
    await page.goto('/synthetic-inline-script')
    await expectRecorded(problems, 'securitypolicyviolation', 'script-src')
    // The browser logs the same block to its console before it fires the event (Chromium and
    // WebKit as an error, Firefox as a warning); that companion entry belongs to this case too.
    const companion = (p: Problem): boolean =>
      p.kind === 'console.error' && /content.security.policy|script-src/i.test(p.detail)
    problems.splice(0, problems.length, ...problems.filter((p) => !companion(p)))
  })

  test('fails the test at the end when a problem was recorded', ({ page, problems }) => {
    // The body cannot fail by itself: no navigation, no wait. Only the fixture's teardown can.
    // `page` is requested so that the overriding fixture, and with it the teardown, is set up.
    test.fail()
    expect(page.isClosed()).toBe(false)
    problems.push({ kind: 'pageerror', detail: 'synthetic problem left for the teardown' })
  })
})
