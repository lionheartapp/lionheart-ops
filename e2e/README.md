# Lionheart E2E Tests

End-to-end coverage for the Lionheart platform using **Playwright**.
(Unit & integration tests live under `__tests__/` and run via Vitest — see the root CI workflow.)

## What's covered

| Area              | Location                   | What it tests                                                                             |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| UI flows          | `e2e/ui/*.spec.ts`         | Login, signup, dashboard, settings/members, tickets, events, plus a generic "buttons-smoke" sweep |
| API endpoints     | `e2e/api/*.spec.ts`        | Auth, `{ok,data}` envelope contract, tickets CRUD, rate-limit (opt-in)                    |
| Permissions       | `e2e/permissions/*.spec.ts`| Unauthenticated 401/403, RBAC boundary checks, **cross-org tenancy isolation**            |
| Accessibility     | `e2e/a11y/*.spec.ts`       | axe-core WCAG 2.1 AA on public + authenticated pages                                      |

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
npm run test:e2e:perms      # Permission / tenancy tests
npm run test:e2e:a11y       # Accessibility audits
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
