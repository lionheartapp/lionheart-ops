---
aliases: [Developer Experience, withAuth, DX Plan]
tags: [development, dx, refactoring, completed]
created: 2026-04-08
---

# DX Improvements — withAuth Adoption + Decomposition

**Status:** ALL PHASES COMPLETE

## Phase 1 — Foundation

- `src/lib/hooks/useModalState.ts` — modal open/close/data hook
- `src/lib/hooks/useFormState.ts` — form values/dirty/submit/error hook
- `vitest.config.mts` — added `.tsx` include pattern
- `__tests__/helpers/route-test-helpers.ts` — mock factories for route tests
- `__tests__/lib/hooks/` — 15 tests passing
- Installed: `@testing-library/react`, `@testing-library/dom`, `jsdom`

## Phase 2 — withAuth Migration: Settings Routes (36 files)

- **2A (14):** teams, roles, permissions, principals, schools, campus areas/rooms/assignments
- **2B (10):** users, buildings, campuses, campus root, map-data, images, detect-outline
- **2C (12):** organization, approval-config, branding, school-info, audit-logs, billing (4), export (3)

## Phase 3 — withAuth Migration: Core Feature Routes (~255 files)

- **Total withAuth routes: 291 files** (verified via grep)
- **TypeScript: 0 errors** from migration

See [[API Routes]] for the full route inventory.

## Phase 4A — MembersTab Decomposition

`src/components/settings/members/` — 7 files, largest ~250 lines

## Phase 4B — CreateEventProjectModal Split

Extracted `PeoplePicker` -> `src/components/events/PeoplePicker.tsx` (~165 lines)
`CreateEventProjectModal.tsx`: 789 -> 624 lines

## Phase 4C — EventOverviewTab Split

Created `src/components/events/overview/` with 5 sub-components:
- `AIStatusSection.tsx`, `FeedbackAnalysisSection.tsx`, `ApprovalGatesBar.tsx`, `ConflictBanner.tsx`, `ResourceRequirementsSection.tsx`
- `EventOverviewTab.tsx`: 1081 -> 525 lines

See [[Components#Events (~60 files)]] for the full event component inventory.

## Phase 5 — Test Coverage

| Test File | Count | Coverage |
|-----------|-------|----------|
| `with-auth.test.ts` | 16 | Auth, permissions, Zod, error classification, params |
| `teams.test.ts` | 7 | GET list, POST create/validation/slug |
| `roles.test.ts` | 8 | GET list, POST create/validation/permissionIds |
| `users.test.ts` | 11 | GET pagination/search/filters, POST create/validation/conflict/email-normalization |
| `PeoplePicker.test.tsx` | 10 | Render, search, select, remove, initials, empty state |
| **Total** | **52** | All passing |

Installed: `@testing-library/jest-dom` for DOM matchers

> [!warning] Route tests must inline `vi.mock()` calls — `setupRouteMocks()` helper can't be used inside `vi.hoisted()` due to import timing.

> [!note] Component tests use `@vitest-environment jsdom` directive + `import '@testing-library/jest-dom/vitest'` for DOM matchers.

## Key Reference

- **withAuth wrapper**: `src/lib/api/with-auth.ts` (242 lines)
- **Pre-existing type errors**: `members/types.ts` (JSX in .ts file)
- **Pre-existing test failure**: `assistant-prompt.test.ts` (prompt content changed)
