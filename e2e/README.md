# Lionheart E2E Tests

End-to-end coverage for the Lionheart platform using **Playwright**.
(Unit & integration tests live under `__tests__/` and run via Vitest — see the root CI workflow.)

## What's covered

| Area              | Location                   | What it tests                                                                             |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| UI flows          | `e2e/ui/*.spec.ts`         | Login, signup, dashboard, settings/members, tickets, events, plus a generic "buttons-smoke" sweep over every page |
| Per-role flows    | `e2e/ui/flows/*.spec.ts`   | End-to-end journeys for super-admin and member; cross-role ticket lifecycle (see `e2e/ui/flows/README.md`) |
| Forms             | `e2e/ui/forms-smoke.spec.ts` | Auto-discovers Add/Create/Invite triggers on every page, opens the form, submits empty, checks for validation feedback |
| Visual regression | `e2e/ui/visual-regression.spec.ts` | Full-page screenshot of every page, compared against baseline. First run writes the baseline. |
| Monkey test       | `e2e/ui/monkey-test.spec.ts` | Random clicker — picks visible buttons/links/menus at random for ~12s per page, fails on any uncaught error. Reproducible via `E2E_MONKEY_SEED`. |
| Mobile            | `e2e/ui/mobile.spec.ts`      | Mobile-viewport assertions: no horizontal scroll, hamburger menu, tap targets ≥40×40, no clipped fixed elements |
| API endpoints     | `e2e/api/*.spec.ts`        | Auth, `{ok,data}` envelope contract, tickets CRUD, rate-limit (opt-in)                    |
| Permissions       | `e2e/permissions/*.spec.ts`| Unauthenticated 401/403, RBAC boundary checks, **cross-org tenancy isolation**, **full permission matrix auto-generated from every API route** |
| Link integrity    | `e2e/ui/link-crawler.spec.ts`, `e2e/ui/link-checker.spec.ts` | Crawler walks every page; checker probes every `<a href>` (internal + external + mailto + tel) |
| Accessibility     | `e2e/a11y/*.spec.ts`       | axe-core WCAG 2.1 AA on public + every authenticated page                                |
| Manual            | `e2e/MANUAL-CHECKLIST.md`  | Pre-release human checklist — run before every meaningful release                        |

### Generated fixtures

Two scripts walk the app and produce JSON fixtures the specs consume. Re-run them after adding pages or API routes:

```bash
npm run inventory:routes    # → e2e/fixtures/route-inventory.json
npm run inventory:pages     # → e2e/fixtures/page-inventory.json
npm run inventory:all       # both
```

`route-inventory.json` is the source of truth for the permission matrix. `page-inventory.json` is the source of truth for the crawler, link checker, buttons-smoke, and a11y page list.

## Setup

```bash
# 1. Install Playwright browsers (first time only)
npm run test:e2e:install

# 2. Copy env template and fill in staging creds
cp .env.e2e.example .env.e2e
# edit .env.e2e with your staging URL, org IDs, and test users

# 3. Run
npm run test:e2e
```

For local runs that should not share `.next` with a running dev server, use the clean runner:

```bash
npm run test:e2e:local
```

It builds once, starts `next start` on an open local port, points Playwright at that server, and shuts the server down when the run ends.

### Required test users on staging

Create these once on the staging DB (the `db:seed:remote` script can be adapted):

| User                     | Role         | Purpose                                     |
| ------------------------ | ------------ | ------------------------------------------- |
| `E2E_ADMIN_EMAIL`        | super-admin  | Can do everything in Org A                  |
| `E2E_MEMBER_EMAIL`       | member       | RBAC boundary — should be denied admin ops  |
| `E2E_ORG_B_ADMIN_EMAIL`  | super-admin  | Lives in Org B — proves tenancy isolation   |

## Running subsets

```bash
npm run test:e2e:api        # API-only (fast, no browser)
npm run test:e2e:local -- --project=api  # API-only against a clean local production server
npm run test:e2e:perms      # All permission tests (RBAC + tenancy + matrix)
npm run test:e2e:matrix     # Just the auto-generated permission matrix
npm run test:e2e:a11y       # Accessibility audits
npm run test:e2e:linkcheck  # External + internal link probe
npm run test:e2e:crawl      # Crawler with screenshots saved
npm run test:e2e:forms      # Auto-discovered form fuzz (validation feedback)
npm run test:e2e:flows      # Per-role user-journey specs
npm run test:e2e:vr         # Visual regression sweep
npm run test:e2e:vr:update  # Accept new visual baselines on purpose
npm run test:e2e:monkey     # Random clicker (deterministic via E2E_MONKEY_SEED)
npm run test:e2e:mobile     # Mobile viewport hygiene assertions
npm run test:e2e:chromium   # UI tests on Chromium only
npm run test:e2e:ui         # Playwright's interactive UI mode
npm run test:e2e:headed     # Watch the browser
npm run test:e2e:debug      # Step through with inspector
npm run test:e2e:report     # Open the last HTML report
```

Run a single file:

```bash
npx playwright test e2e/ui/login.spec.ts
```

Run with a grep filter:

```bash
npx playwright test -g "tenancy isolation"
```

## Config

All config lives in `playwright.config.ts` at the repo root. Key points:

- **baseURL** comes from `E2E_BASE_URL`. When unset locally, `webServer` spins up `npm run dev` on :3004.
- **Projects** split tests by suite so you can target just one.
- **Retries** are on (2x) in CI, off locally for fast feedback.
- **Sharding** is handled by the CI workflow (4 shards in parallel).

## Multi-tenancy tests

`e2e/permissions/tenant-isolation.spec.ts` is the most important file in this folder. It creates data in Org A, then logs into Org B and proves:

1. Org A's data does not appear in Org B's list queries.
2. Fetching Org A's resource ID directly from Org B returns 403/404.
3. Forging the `x-org-id` header from a valid Org B JWT does not leak data.

If these ever fail: **stop shipping, drop everything, fix immediately.**

## Adding tests

### New UI flow

```ts
// e2e/ui/my-feature.spec.ts
import { test, expect } from '../fixtures'

test('admin can do the new thing', async ({ adminPage }) => {
  await adminPage.goto('/my-feature')
  await adminPage.getByRole('button', { name: /do the thing/i }).click()
  await expect(adminPage.getByText(/success/i)).toBeVisible()
})
```

### New API endpoint

```ts
// e2e/api/my-endpoint.spec.ts
import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api'
import { env } from '../helpers/env'

test('GET /api/my-endpoint returns data', async () => {
  const client = await ApiClient.login({
    email: env.orgA.adminEmail,
    password: env.orgA.adminPassword,
    organizationId: env.orgA.id,
  })
  const { body } = await client.get('/api/my-endpoint')
  assertOk(body)
  await client.dispose()
})
```

### New permission check

Add a case to `e2e/permissions/rbac.spec.ts` — one test per new permission that the member role should be denied.

## Data hygiene

Every factory in `e2e/helpers/data.ts` prefixes test fixtures with `e2e-` (and a UUID). A janitorial script can sweep them from staging:

```sql
DELETE FROM "Ticket" WHERE title LIKE 'e2e-ticket-%';
DELETE FROM "Event" WHERE title LIKE 'e2e-event-%';
-- etc.
```

## Opt-in / destructive tests

These only run when explicit env vars are set, because they pollute or throttle staging:

| Env var                   | What it unlocks                                  |
| ------------------------- | ------------------------------------------------ |
| `E2E_ALLOW_SIGNUP=1`      | Org-signup flow (creates a real org every run)   |
| `E2E_TEST_RATE_LIMIT=1`   | Login rate-limiter stress (will trip your IP)    |

Neither is enabled in the default CI workflow.

## CI

`.github/workflows/e2e.yml` runs on every PR and push to `main`, in 4 parallel shards, against the `E2E_BASE_URL` secret. HTML reports + traces are uploaded as artifacts (14-day retention, 7 for traces).

Flaky tests are retried twice in CI. If a test is consistently flaky, file an issue — don't add `.skip` without a link.
