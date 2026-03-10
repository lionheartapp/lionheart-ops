---
phase: 10-inventory-system
plan: "01"
subsystem: database
tags: [prisma, inventory, permissions, notifications, zod, typescript]

# Dependency graph
requires:
  - phase: 08-auth-hardening-and-security
    provides: Permission system, PERMISSIONS constants, DEFAULT_ROLES, sanitize utilities
  - phase: 07-knowledge-base
    provides: notificationService pattern with createBulkNotifications
provides:
  - InventoryTransaction model with full CHECKOUT/CHECKIN/ADJUSTMENT audit trail
  - InventoryItem extended with category and sku fields
  - INVENTORY_CHECKOUT and INVENTORY_CHECKIN permissions assigned to admin+member roles
  - inventoryService.ts with CRUD, checkout/checkin, transaction log, low-stock alerts
  - inventory_low_stock NotificationType for in-app alerts
affects:
  - 10-02 (API routes will consume inventoryService)
  - 10-03 (UI will use service exports and INVENTORY_CATEGORIES constant)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InventoryTransaction as immutable audit record — NOT in softDeleteModels, not hard-deleted"
    - "Atomic decrement + race condition guard for concurrent checkout safety"
    - "Fire-and-forget low-stock notification via void notifyLowStock()"
    - "orgScopedPrisma create() uses 'as any' cast since extension injects organizationId at runtime"

key-files:
  created:
    - src/lib/services/inventoryService.ts
  modified:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/permissions.ts
    - src/lib/services/notificationService.ts

key-decisions:
  - "InventoryTransaction quantity is signed: negative for CHECKOUT, positive for CHECKIN/ADJUSTMENT — single field encodes direction"
  - "InventoryTransaction is NOT soft-deleted — transactions are immutable audit records; only InventoryItem is soft-deleted"
  - "Low-stock notification fires after successful checkout when quantity < reorderThreshold — not on ADJUSTMENT or CHECKIN"
  - "INVENTORY_CHECKOUT and INVENTORY_CHECKIN assigned to both ADMIN and MEMBER roles — staff need checkout/checkin capability"
  - "getUsersWithPermission finds INVENTORY_UPDATE holders as low-stock alert recipients — inventory managers"

patterns-established:
  - "Service pattern: all functions wrap in runWithOrgContext, throw errors with .code property for route-level error handling"
  - "Race condition guard: decrement atomically, check if result < 0, increment back and throw if so"
  - "Checkout stores quantity as negative integer; checkin uses Math.abs(transaction.quantity) to recover return quantity"

requirements-completed: [INV-01, INV-02, INV-03, INV-04, INV-05]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 10 Plan 01: Inventory Schema and Service Layer Summary

**InventoryTransaction audit model with atomic checkout/checkin, Prisma schema extension, and full inventoryService business logic with low-stock notifications**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T13:56:00Z
- **Completed:** 2026-03-10T14:08:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended InventoryItem with category and sku fields, plus an index on (organizationId, category) for filtered queries
- Created InventoryTransaction model with CHECKOUT/CHECKIN/ADJUSTMENT enum, full actor/timestamp tracking, and three indexes for efficient queries
- Added INVENTORY_CHECKOUT and INVENTORY_CHECKIN to PERMISSIONS, assigned to ADMIN and MEMBER roles
- Added inventory_low_stock to NotificationType union
- Built complete inventoryService.ts: CRUD, atomic checkout with race condition guard, checkin from open transaction, transaction log, and fire-and-forget low-stock alerts targeting INVENTORY_UPDATE permission holders

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema with InventoryTransaction model and push to DB** - `ed09e38` (feat)
2. **Task 2: Add permissions, notification type, and build inventoryService.ts** - `f8aafa1` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - InventoryItem extended (category, sku, transactions relation, category index); InventoryTransactionType enum; InventoryTransaction model; Organization and User relation additions
- `src/lib/db/index.ts` - InventoryTransaction added to orgScopedModels Set
- `src/lib/permissions.ts` - INVENTORY_CHECKOUT and INVENTORY_CHECKIN constants; assigned to ADMIN and MEMBER DEFAULT_ROLES
- `src/lib/services/notificationService.ts` - inventory_low_stock added to NotificationType union
- `src/lib/services/inventoryService.ts` - Full service layer: CRUD + checkout/checkin + getTransactions + notifyLowStock

## Decisions Made

- **Signed quantity on InventoryTransaction:** Negative for CHECKOUT, positive for CHECKIN/ADJUSTMENT. Single field encodes both magnitude and direction; checkin recovers quantity with Math.abs().
- **InventoryTransaction not soft-deleted:** Transaction rows are immutable audit records — once created they must never be modified or hidden. Only InventoryItem participates in soft-delete.
- **Low-stock target: INVENTORY_UPDATE holders:** Users who can manage/update inventory items are the natural recipients for low-stock alerts. Follows same getUsersWithPermission pattern as maintenanceNotificationService.
- **INVENTORY_CHECKOUT and INVENTORY_CHECKIN on MEMBER role:** Staff-level users need to check items in/out without full inventory management rights. The split between checkout/checkin and create/update/delete mirrors the IT loaner pool pattern.
- **Race condition guard after atomic decrement:** Even with atomic decrement, distributed deployment can have two requests both pass the pre-check. If updated quantity is negative, we immediately increment back and throw INSUFFICIENT_STOCK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `as any` cast on orgScopedPrisma create() calls**
- **Found during:** Task 2 (inventoryService.ts creation)
- **Issue:** TypeScript expected explicit `organizationId` on create() data for org-scoped models, but the Prisma extension injects it at runtime. Two TS errors: one for InventoryItem.create, one for InventoryTransaction.create.
- **Fix:** Added `as any` cast on both create data objects — consistent with `notificationService.ts` which uses the same pattern (`data: items.map(...) as any`)
- **Files modified:** src/lib/services/inventoryService.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** f8aafa1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug in Prisma create data)
**Impact on plan:** Necessary fix for TypeScript correctness — consistent with established project pattern. No scope creep.

## Issues Encountered

None — plan executed cleanly. The only issue was the predictable Prisma type error for org-scoped models (well-established fix pattern in this codebase).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- inventoryService.ts is complete and TypeScript-clean — ready for 10-02 (API routes)
- All exported functions match the plan's `exports` list exactly: createItem, updateItem, deleteItem, getItem, listItems, checkoutItem, checkinItem, getTransactions
- INVENTORY_CATEGORIES constant exported for use in UI dropdowns (10-03)
- Schema pushed to local DB; production push needed before deploying 10-02 API routes

---
*Phase: 10-inventory-system*
*Completed: 2026-03-10*
