---
phase: 10-inventory-system
plan: "02"
subsystem: api
tags: [nextjs, api-routes, inventory, permissions, zod, smoke-test, typescript, sidebar]

# Dependency graph
requires:
  - phase: 10-inventory-system
    plan: "01"
    provides: inventoryService.ts with CRUD, checkout/checkin, getTransactions; INVENTORY_* permissions; InventoryTransaction model
  - phase: 08-auth-hardening-and-security
    provides: isAuthError helper in api-response.ts; canonical route boilerplate pattern
provides:
  - GET /api/inventory with search and category filter query params
  - POST /api/inventory with Zod validation (201 on success)
  - GET /api/inventory/[id] — single item fetch with NOT_FOUND handling
  - PUT /api/inventory/[id] — item update with Zod validation
  - DELETE /api/inventory/[id] — soft-delete returning { deleted: true }
  - GET /api/inventory/[id]/transactions — checkout/checkin audit log
  - POST /api/inventory/[id]/checkout — atomic decrement, 409 on INSUFFICIENT_STOCK
  - POST /api/inventory/[id]/checkin — quantity restore from transaction, 409 on ALREADY_CHECKED_IN
  - Sidebar Inventory nav item (Package icon, /inventory link)
  - scripts/smoke-inventory.mjs — full CRUD + checkout/checkin smoke test
affects:
  - 10-03 (UI will call these API routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route error handling: check .code property (NOT_FOUND, INSUFFICIENT_STOCK, ALREADY_CHECKED_IN) before falling through to generic 500"
    - "Checkin route receives transactionId in body — route [id] param is present but not needed (service resolves item via transaction)"
    - "Smoke test auth: check Set-Cookie first, fall back to Bearer token — supports both auth migration states"

key-files:
  created:
    - src/app/api/inventory/route.ts
    - src/app/api/inventory/[id]/route.ts
    - src/app/api/inventory/[id]/transactions/route.ts
    - src/app/api/inventory/[id]/checkout/route.ts
    - src/app/api/inventory/[id]/checkin/route.ts
    - scripts/smoke-inventory.mjs
  modified:
    - src/components/Sidebar.tsx
    - package.json

key-decisions:
  - "Checkin route destructures params as _id (unused) — the checkinItem service resolves the item via transactionId in body, making the URL [id] param redundant but keeping URL REST-consistent"
  - "Smoke test supports dual auth modes: checks Set-Cookie header first for httpOnly cookie auth, falls back to Bearer token — compatible with phase 08 auth migration"
  - "Inventory nav item added to base navItems array (not permission-gated) — INVENTORY_READ is on viewer/member/admin roles, so all logged-in users can see it; matches existing Dashboard/Calendar behavior"

patterns-established:
  - "Service error code mapping: catch error.code property (NOT_FOUND, INSUFFICIENT_STOCK, ALREADY_CHECKED_IN) → map to HTTP status 404/409/409"
  - "Smoke test auth negotiation: prefer cookie-based, fallback to token — future-proof for auth migration"

requirements-completed: [INV-01, INV-02, INV-03, INV-04, INV-05]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 10 Plan 02: Inventory API Routes Summary

**Five authenticated REST route handlers for inventory CRUD + checkout/checkin workflow, sidebar nav item, and smoke test covering all INV requirements**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T14:14:02Z
- **Completed:** 2026-03-10T14:17:50Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Replaced no-auth inventory stub with fully authenticated GET + POST /api/inventory (search/category filters, Zod validation, 201 on create)
- Built GET/PUT/DELETE /api/inventory/[id] with NOT_FOUND error handling and proper HTTP status codes
- Built GET /api/inventory/[id]/transactions, POST checkout (409 on insufficient stock), POST checkin (409 on already checked in)
- Added Inventory nav item with Package icon to sidebar navItems array linking to /inventory
- Created comprehensive smoke test (10 scenarios: create, list, search, get, update, checkout, transactions, checkin, insufficient-stock rejection, delete)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build all 5 API route handlers** - `ea80b31` (feat)
2. **Task 2: Add sidebar Inventory nav item and create smoke test** - `0f49316` (feat)

## Files Created/Modified

- `src/app/api/inventory/route.ts` - GET (list with filters) + POST (create) — replaced stub
- `src/app/api/inventory/[id]/route.ts` - GET (single) + PUT (update) + DELETE (soft-delete)
- `src/app/api/inventory/[id]/transactions/route.ts` - GET transaction audit log
- `src/app/api/inventory/[id]/checkout/route.ts` - POST checkout with INSUFFICIENT_STOCK guard
- `src/app/api/inventory/[id]/checkin/route.ts` - POST checkin with ALREADY_CHECKED_IN guard
- `src/components/Sidebar.tsx` - Added Package icon import, added Inventory to navItems array
- `scripts/smoke-inventory.mjs` - Full smoke test: create, list, search, get, update, checkout, transactions, checkin, 409 guard, delete
- `package.json` - Added smoke:inventory script

## Decisions Made

- **Checkin [id] param unused but present:** The checkin route destructures params as `_id` (underscore convention for intentionally unused). The service resolves the item through `transactionId` in the request body — the URL item ID is redundant but kept for REST URL consistency.
- **Inventory nav item not permission-gated:** INVENTORY_READ is assigned to viewer, member, and admin roles — all logged-in users have it. Gating would just hide it from people who already can't call the API. Matches Dashboard/Calendar behavior in navItems.
- **Smoke test dual auth mode:** Checks for `Set-Cookie` header first (phase 08 httpOnly cookie auth), falls back to `Authorization: Bearer` header. Makes the smoke test work in both the current and post-migration states.

## Deviations from Plan

None — plan executed exactly as written. All 5 routes follow the canonical boilerplate, error codes map exactly as specified, sidebar addition is straightforward.

## Issues Encountered

None — inventoryService.ts from plan 10-01 exported exactly the schemas and functions the routes needed. TypeScript compiled clean on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 API routes are live and TypeScript-clean — ready for 10-03 (UI layer)
- `scripts/smoke-inventory.mjs` can be run against the dev server to verify the full workflow end-to-end
- Sidebar Inventory link is wired — users can navigate to /inventory once the page is built in 10-03
- INVENTORY_CATEGORIES constant (from inventoryService) is ready for use in UI dropdowns

## Self-Check: PASSED

All 7 created/modified files confirmed present. Both task commits (ea80b31, 0f49316) confirmed in git log.

---
*Phase: 10-inventory-system*
*Completed: 2026-03-10*
