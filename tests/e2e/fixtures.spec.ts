import { expect, expectedResponseHeaders, test, type Problem, type ProblemKind } from './fixtures'

// The shared fixture's passing-and-failing proof in every browser (plan §6: a page error, a console
// error or a CSP violation fails the test). Three cases make the page report one problem each and
// check that the fixture recorded it; the last case leaves its problem in place and is declared an
// expected failure, so Playwright goes red the day the fixture stops failing the test.

/** Waits until the fixture recorded a problem of `kind` mentioning `detail`, then consumes it so the case ends clean. */
async function expectRecorded(
  problems: Problem[],
  kind: ProblemKind,
  detail: string,
): Promise<void> {
  await expect
    .poll(() => problems)
    .toContainEqual(expect.objectContaining({ kind, detail: expect.stringContaining(detail) }))
  problems.splice(0)
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
  })

  test('fails the test at the end when the page reported a problem', async ({ page }) => {
    test.fail()
    await page.goto('/')
    const reported = page.waitForEvent('pageerror')
    await page.evaluate(throwLater)
    await reported
  })
})
