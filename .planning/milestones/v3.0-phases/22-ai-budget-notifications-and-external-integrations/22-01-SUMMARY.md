---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 01
subsystem: events-budget
tags: [budget, prisma, api-routes, permissions, phase-22]
dependency_graph:
  requires: []
  provides:
    - BudgetCategory Prisma model
    - BudgetLineItem Prisma model
    - BudgetRevenue Prisma model
    - BudgetRevenueSource enum
    - budgetService.ts (CRUD + report aggregation)
    - Budget API routes (5 files)
    - EVENTS_BUDGET_MANAGE and EVENTS_BUDGET_READ permissions
  affects:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/permissions.ts
    - EventProject model (new budget relations)
    - Organization model (new budget relations)
    - User model (new budget relations)
tech_stack:
  added: []
  patterns:
    - prisma-as-any cast for org-scoped models (Phase 21 pattern)
    - Supabase signed upload URL for receipt images
    - syncRegistrationRevenue: rawPrisma for cross-context payment lookups
key_files:
  created:
    - prisma/schema.prisma (BudgetCategory, BudgetLineItem, BudgetRevenue, BudgetRevenueSource)
    - src/lib/types/budget.ts
    - src/lib/services/budgetService.ts
    - src/app/api/events/projects/[id]/budget/route.ts
    - src/app/api/events/projects/[id]/budget/[lineId]/route.ts
    - src/app/api/events/projects/[id]/budget/[lineId]/receipt-url/route.ts
    - src/app/api/events/projects/[id]/budget/revenue/route.ts
    - src/app/api/events/projects/[id]/budget/report/route.ts
  modified:
    - src/lib/db/index.ts (BudgetCategory, BudgetLineItem, BudgetRevenue added to orgScopedModels)
    - src/lib/permissions.ts (EVENTS_BUDGET_MANAGE, EVENTS_BUDGET_READ added)
decisions:
  - Budget models use hard delete (not soft delete) for clean accounting integrity
  - syncRegistrationRevenue uses RegistrationStatus.REGISTERED (not CONFIRMED — no such status exists)
  - Registration revenue sync sums succeeded RegistrationPayment rows (not raw registration.paymentStatus)
  - BudgetCategory has @@unique([eventProjectId, name]) to prevent duplicate categories per event
  - initializeCategories is idempotent — checks for any existing category before seeding presets
  - Receipt uploads go to event-receipts Supabase bucket with path orgId/eventProjectId/lineId/timestamp-filename
metrics:
  duration: ~18min
  completed: "2026-03-15"
  tasks: 3
  files: 8
---

# Phase 22 Plan 01: Budget Data Layer Summary

Budget data layer for event project financial management — 3 Prisma models, a comprehensive service layer, and 5 API routes enabling budget tracking, expense logging, revenue management, and per-participant cost analysis.

## What Was Built

### Task 1: Schema, Org-Scope, Permissions, Client Types

Three new Prisma models:

- **BudgetCategory** — reusable expense categories per event (10 preset names + custom). Unique per event on `(eventProjectId, name)`.
- **BudgetLineItem** — individual budget line with `budgetedAmount`, optional `actualAmount`, vendor, receipt URL, expense date, and notes. Hard delete for accounting integrity.
- **BudgetRevenue** — revenue entries with source enum (REGISTRATION_FEE, SPONSORSHIP, FUNDRAISING, DONATION, GRANT, OTHER). `isAutoPopulated=true` marks Stripe-synced rows.

All 3 models registered in `orgScopedModels` in `src/lib/db/index.ts`.

Two new permissions:
- `EVENTS_BUDGET_MANAGE` — create/edit/delete budget items (ADMIN + SUPER_ADMIN)
- `EVENTS_BUDGET_READ` — view budget data (ADMIN + SUPER_ADMIN + MEMBER)

`src/lib/types/budget.ts` exports Zod schemas (`BudgetLineItemInputSchema`, `BudgetRevenueInputSchema`), the `BUDGET_CATEGORY_PRESETS` array (10 items), and TypeScript interfaces for report data.

### Task 2: Budget Service Layer

`src/lib/services/budgetService.ts` with 15 exported functions:

- **Category management:** `initializeCategories` (idempotent preset seeding), `getCategories`, `createCategory`, `updateCategory`, `deleteCategory` (fails if has line items)
- **Line item CRUD:** `getLineItems` (with optional `categoryId` filter), `createLineItem` (validates category ownership), `updateLineItem`, `deleteLineItem`
- **Revenue:** `getRevenue`, `createRevenue`, `updateRevenue`, `deleteRevenue`, `syncRegistrationRevenue`
- **Reporting:** `getBudgetReport` (returns `BudgetReportData` with per-category summaries, totals, net position, registration count, per-participant cost)

All functions use `(prisma as any)` cast pattern consistent with Phase 21 decisions.

### Task 3: Budget API Routes (5 files)

1. **`/budget`** — GET lists categories+line items (seeds presets on first access), POST creates line item
2. **`/budget/[lineId]`** — PATCH updates line item, DELETE removes it
3. **`/budget/[lineId]/receipt-url`** — POST generates Supabase signed upload URL for receipt images (validates MIME type, event-receipts bucket)
4. **`/budget/revenue`** — Full CRUD (GET ?sync=true triggers Stripe sync first)
5. **`/budget/report`** — GET syncs Stripe revenue then returns full budget vs actual report

All routes follow the standard pattern: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RegistrationStatus.CONFIRMED does not exist**
- **Found during:** Task 2 (TypeScript compile)
- **Issue:** Plan specified `status: 'CONFIRMED'` for syncRegistrationRevenue, but RegistrationStatus enum has DRAFT/REGISTERED/WAITLISTED/CANCELLED — no CONFIRMED value
- **Fix:** Changed to `status: 'REGISTERED'` and queried through `RegistrationPayment` model with `status: 'succeeded'` filter for accurate payment sum
- **Files modified:** `src/lib/services/budgetService.ts`
- **Commit:** ba0bf22

## Self-Check: PASSED

All 7 output files present. All 3 task commits found (3e46131, ba0bf22, a69a9e6). Schema validates. TypeScript compiles with zero budget-related errors (1 pre-existing test file error unrelated to this plan).

## Self-Check
