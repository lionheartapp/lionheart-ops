---
phase: 13-infrastructure-and-observability
plan: "01"
subsystem: testing
tags: [vitest, prisma, unit-tests, ci, github-actions, tsc, eslint]

requires: []
provides:
  - Vitest v4 test framework with node environment and @/ path alias support
  - Prisma mock singleton pattern using vitest-mock-extended async factory
  - Unit tests for auth (JWT sign/verify), permissions (can/assertCan/cache), org-context (AsyncLocalStorage)
  - CI pipeline with type-check, lint, and test gates before build

affects:
  - all future plans that add new service/utility code (test coverage expected)
  - all PRs that modify auth, permissions, or org-context modules

tech-stack:
  added:
    - vitest@4.0.18
    - "@vitejs/plugin-react@5.1.4"
    - vite-tsconfig-paths@6.1.1
    - vitest-mock-extended@3.1.0
  patterns:
    - Async vi.mock factory with vi.hoisted for Prisma mock (avoids CJS/hoisting conflicts)
    - DeepMockProxy reset in beforeEach for test isolation
    - AUTH_SECRET injected via vitest.config.mts test.env (no real secrets in test run)

key-files:
  created:
    - vitest.config.mts
    - .env.test
    - src/lib/__mocks__/db.ts
    - __tests__/lib/auth.test.ts
    - __tests__/lib/permissions.test.ts
    - __tests__/lib/org-context.test.ts
  modified:
    - .github/workflows/ci.yml
    - package.json

key-decisions:
  - "vi.mock async factory (not __mocks__ directory) required because Vitest path alias resolution does not auto-detect __mocks__ for @/ imports"
  - "vi.hoisted used to initialize mock reference before vi.mock factory hoisting"
  - "DATABASE_URL empty string in test env — all DB calls mocked via vitest-mock-extended"
  - "Docker Postgres CI services deferred to future plan when integration tests need real DB"

patterns-established:
  - "Permissions test pattern: vi.mock('@/lib/db', async () => { ... }) with mockDeep<PrismaClient>() and clearPermissionCache in beforeEach"
  - "Auth test pattern: direct import, no mock needed — uses AUTH_SECRET from vitest.config.mts env"
  - "Org-context test pattern: direct import, NextRequest constructed with Headers for getOrgIdFromRequest tests"

requirements-completed:
  - INFRA-01
  - INFRA-02

duration: 6min
completed: 2026-03-11
---

# Phase 13 Plan 01: Vitest Setup and CI Quality Gates Summary

**Vitest unit test framework with Prisma deep-mock pattern, 15 passing tests covering auth/permissions/org-context, and CI pipeline with type-check + lint + test gates**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-11T16:54:54Z
- **Completed:** 2026-03-11T17:00:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed Vitest v4 with tsconfigPaths and React plugin, 15 tests passing in under 200ms
- Established async `vi.mock` factory pattern for Prisma mocking (critical for @/ alias resolution)
- Wrote tests covering JWT roundtrip, token tampering, permission matching, cache behavior, and AsyncLocalStorage propagation
- Extended CI pipeline with type-check, lint, and test steps that run before build on every PR

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Vitest, create config, Prisma mock singleton, and write foundational unit tests** - `3caae65` (feat)
2. **Task 2: Extend GitHub Actions CI pipeline with type-check, lint, and test steps** - `a025cf2` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `vitest.config.mts` - Vitest configuration with tsconfigPaths, node environment, AUTH_SECRET env var
- `.env.test` - Test environment variables (AUTH_SECRET, empty DATABASE_URL/DIRECT_URL)
- `src/lib/__mocks__/db.ts` - Prisma mock singleton with usage documentation and correct factory pattern
- `__tests__/lib/auth.test.ts` - 4 tests: sign roundtrip, verify valid, verify garbage, verify corrupted signature
- `__tests__/lib/permissions.test.ts` - 7 tests: matching, wildcard, no-match, assertCan throw/pass, cache hit, cache clear
- `__tests__/lib/org-context.test.ts` - 4 tests: AsyncLocalStorage propagation, missing context error, request header present/absent
- `.github/workflows/ci.yml` - Added type-check, lint, test steps; AUTH_SECRET on build; TODO for Docker Postgres
- `package.json` - Added `"test": "vitest run"` script; devDependencies updated by npm install

## Decisions Made
- `vi.mock` async factory is required over `__mocks__` auto-detection because Vitest's automatic `__mocks__` directory lookup does not follow Vite path aliases like `@/`. The factory pattern `vi.mock('@/lib/db', async () => { ... })` is the correct approach.
- `vi.hoisted()` used to declare mock reference variable before hoisting — avoids "Cannot access before initialization" error.
- `mockReset(rawPrismaMock)` in each `beforeEach` ensures no test state bleeds across tests.
- Docker Postgres `services:` block deferred to CI file — current tests are all mock-based, no real DB needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used async vi.mock factory instead of __mocks__ directory**
- **Found during:** Task 1 (permissions test implementation)
- **Issue:** Vitest's automatic `__mocks__` directory resolution does not work with `@/` path aliases (tsconfigPaths). Tests with `vi.mock('@/lib/db')` received auto-mocked plain functions without `mockResolvedValue`.
- **Fix:** Changed to `vi.mock('@/lib/db', async () => { const { mockDeep } = await import('vitest-mock-extended'); ... })` pattern. Updated `__mocks__/db.ts` to document the correct usage pattern for future tests.
- **Files modified:** `__tests__/lib/permissions.test.ts`, `src/lib/__mocks__/db.ts`
- **Verification:** All 7 permissions tests pass with proper mock behavior
- **Committed in:** 3caae65 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in mock resolution)
**Impact on plan:** Required fix for test correctness. The `__mocks__/db.ts` file still exists as specified but now documents the correct async factory pattern.

## Issues Encountered
- Vitest `vi.mock` hoisting + `vi.hoisted()` + ESM `require()` combination: `require()` fails in ESM context. Solution: use `vi.hoisted()` to declare a mutable reference, then populate it inside the `async () => import()` factory.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure is ready; new service/utility files should include test files in `__tests__/lib/`
- Permission tests use the async factory mock pattern — copy from `permissions.test.ts` for future DB-touching service tests
- CI now blocks merges on type errors, lint failures, and test failures

---
*Phase: 13-infrastructure-and-observability*
*Completed: 2026-03-11*

## Self-Check: PASSED

- vitest.config.mts: FOUND
- .env.test: FOUND
- src/lib/__mocks__/db.ts: FOUND
- __tests__/lib/auth.test.ts: FOUND
- __tests__/lib/permissions.test.ts: FOUND
- __tests__/lib/org-context.test.ts: FOUND
- .github/workflows/ci.yml: FOUND
- Commit 3caae65: FOUND
- Commit a025cf2: FOUND
- All 15 tests: PASS
