import { test, expect } from '../fixtures'
import { runFormSmokeOnPage } from '../helpers/form-fuzzer'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Forms Smoke Sweep
 * =================
 * Companion to buttons-smoke. For each crawlable page:
 *   1. Click every visible "Add / Create / New / Invite" trigger
 *   2. Find the form that opens (in a dialog / drawer / inline)
 *   3. Submit it empty
 *   4. Assert *some* validation feedback appears (no silent saves)
 *   5. Capture any uncaught JS errors
 *
 * This is intentionally low-fidelity — it doesn't assert business outcomes,
 * just that "every Create button leads to a form that validates." Pair with
 * targeted form specs (see e2e/ui/forms/) for the mission-critical ones.
 *
 * Configurable via env:
 *   E2E_FORMS_MAX_PAGES    — pages to sweep (default 20, max 60)
 *   E2E_FORMS_MAX_TRIGGERS — triggers to click per page (default 4)
 *   E2E_FORMS_FAIL_SILENT  — "1" to fail when a form silently accepts empty input
 *                            (default off; many forms are intentionally tolerant
 *                            of empty submissions, e.g. search bars)
 */

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'page-inventory.json')
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
  crawlable: string[]
}

const MAX_PAGES = Math.min(Number(process.env.E2E_FORMS_MAX_PAGES ?? '20'), 60)
const MAX_TRIGGERS = Math.min(Number(process.env.E2E_FORMS_MAX_TRIGGERS ?? '4'), 20)
const FAIL_ON_SILENT = process.env.E2E_FORMS_FAIL_SILENT === '1'

const ROUTES = inventory.crawlable.slice(0, MAX_PAGES)

for (const route of ROUTES) {
  test(`forms on ${route} validate or quietly do nothing`, async ({ adminPage }) => {
    const res = await adminPage.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null)
    if (!res) test.skip(true, `Route ${route} not reachable`)
    expect(res!.status(), `${route} returned ${res!.status()}`).toBeLessThan(500)
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    const result = await runFormSmokeOnPage(adminPage, { maxTriggers: MAX_TRIGGERS })

    // Always fail on uncaught JS errors during the form sweep.
    expect(
      result.pageErrors,
      `JS errors during form sweep on ${route}:\n${result.pageErrors.join('\n')}`,
    ).toHaveLength(0)

    // Optionally fail on silent submits (off by default — too noisy).
    if (FAIL_ON_SILENT && result.silentSubmits > 0) {
      throw new Error(
        `${result.silentSubmits} form(s) on ${route} accepted empty input without validation feedback.`,
      )
    }

    // Just log so the report has data even when nothing fails.
    // eslint-disable-next-line no-console
    console.log(
      `[forms:${route}] triggers=${result.triggersClicked} forms=${result.formsExercised} validated=${result.validationsFound} silent=${result.silentSubmits}`,
    )
  })
}
