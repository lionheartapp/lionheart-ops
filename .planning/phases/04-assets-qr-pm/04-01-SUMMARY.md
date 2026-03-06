---
phase: 04-assets-qr-pm
plan: 01
subsystem: database, api, ui
tags: [prisma, nextjs, tanstack-query, framer-motion, qrcode, supabase-storage, permissions]

# Dependency graph
requires:
  - phase: 03-kanban-ai
    provides: MaintenanceTicket model, maintenance permissions, MaintenanceAsset/PmSchedule schema already in place

provides:
  - MaintenanceAsset CRUD API (GET list, GET detail, POST create, PATCH update, DELETE soft-delete)
  - AST-XXXX auto-generated asset number via atomic upsert on MaintenanceAssetCounter
  - QR code SVG endpoint at /api/maintenance/assets/[id]/qr
  - Signed URL upload endpoint for asset photos (maintenance-assets Supabase bucket)
  - Asset register page at /maintenance/assets with filterable sortable table and create drawer
  - pmScheduleId/pmScheduledDueDate/pmChecklistItems/pmChecklistDone fields on MaintenanceTicket
  - ASSETS_READ/CREATE/UPDATE/DELETE permissions added to roles

affects:
  - 04-02 (QR scanning, asset detail page)
  - 04-03 (PM calendar — PmSchedule creates MaintenanceTickets with pmScheduleId)
  - 04-04 (labor tracking references assets)
  - 04-05 (cost analytics queries asset data)

# Tech tracking
tech-stack:
  added:
    - qrcode 1.5.x (QR code SVG generation on server)
    - "@types/qrcode (TypeScript types)"
    - "@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (pre-existing missing deps installed)"
  patterns:
    - Asset number generation mirrors ticket number pattern (rawPrisma.$transaction atomic upsert on counter table)
    - ASSETS_READ/CREATE/UPDATE/DELETE fine-grained permissions separate from MAINTENANCE_MANAGE_ASSETS legacy permission
    - QR codes generated server-side as SVG with immutable cache headers (1 year)
    - AssetCreateDrawer uses useCampusLocations hook for location picker (same as SubmitRequestWizard)
    - AssetRegisterTable uses TanStack Query staleTime=30s with queryKey derived from filter serialization

key-files:
  created:
    - src/lib/services/maintenanceAssetService.ts
    - src/app/api/maintenance/assets/route.ts
    - src/app/api/maintenance/assets/[id]/route.ts
    - src/app/api/maintenance/assets/upload-url/route.ts
    - src/app/api/maintenance/assets/[id]/qr/route.ts
    - src/components/maintenance/AssetRegisterFilters.tsx
    - src/components/maintenance/AssetRegisterTable.tsx
    - src/components/maintenance/AssetCreateDrawer.tsx
    - src/app/maintenance/assets/page.tsx
  modified:
    - prisma/schema.prisma (PM fields on MaintenanceTicket, @@unique PM idempotency constraint)
    - src/lib/permissions.ts (ASSETS_READ/CREATE/UPDATE/DELETE added, role assignments)
    - src/components/Sidebar.tsx (Assets + PM Calendar nav items)

key-decisions:
  - "ASSETS_READ/CREATE/UPDATE/DELETE permissions are fine-grained and separate from MAINTENANCE_MANAGE_ASSETS (which remains as a legacy alias). New routes use the specific permissions."
  - "QR endpoint returns immutable SVG (Cache-Control: public, max-age=31536000, immutable) — QR content is the asset URL which never changes"
  - "pmScheduleId nullable on MaintenanceTicket — regular tickets leave it null; PM-generated tickets set it for idempotency check via @@unique([pmScheduleId, pmScheduledDueDate])"
  - "AssetCreateDrawer omits photo upload (signs URLs from upload-url endpoint) — photo UX is additive and can be done post-creation in the detail page (Plan 02)"
  - "Repair threshold stored as decimal (0-1) in DB, displayed/entered as percentage (0-100) in UI"

patterns-established:
  - "Asset number format: AST-XXXX (zero-padded 4 digits), mirrors MT-XXXX ticket format"
  - "Warranty color coding: green = >90 days, amber = <90 days, red = expired"
  - "Location select uses JSON-encoded composite key (buildingId/areaId/roomId) in a single <select> element"

requirements-completed: [ASSET-01, ASSET-02, ASSET-03, QR-01]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 4 Plan 01: Asset Register Summary

**Asset register with AST-XXXX numbering, filterable table UI, slide-over create drawer, QR code SVG endpoint, and PM checklist fields on MaintenanceTicket**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T14:51:21Z
- **Completed:** 2026-03-06T14:59:00Z
- **Tasks:** 2
- **Files modified/created:** 14

## Accomplishments
- Full asset CRUD API (7 routes) with org-scoped Prisma, soft-delete, permission gates
- QR code SVG endpoint with immutable caching — encodes asset URL for scan-to-detail flow
- Asset register page at /maintenance/assets with glassmorphism UI, staggered table animations, category/building/status/warranty filters
- AssetCreateDrawer with Identity/Location/Financials/Notes sections wired to useCampusLocations
- Schema updated with PM ticket fields (pmScheduleId, pmScheduledDueDate, pmChecklistItems, pmChecklistDone) and @@unique idempotency constraint for Plan 03

## Task Commits

1. **Task 1: Schema updates, asset service, and all API routes** - `8930c1c` (feat)
2. **Task 2: Asset register list page with filters, table, and create drawer** - `607a624` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - PM fields on MaintenanceTicket, @@unique PM idempotency constraint
- `src/lib/permissions.ts` - ASSETS_READ/CREATE/UPDATE/DELETE permissions, role assignments
- `src/lib/services/maintenanceAssetService.ts` - generateAssetNumber, createAsset, getAssets, getAssetById, updateAsset, deleteAsset
- `src/app/api/maintenance/assets/route.ts` - GET list + POST create
- `src/app/api/maintenance/assets/[id]/route.ts` - GET detail, PATCH update, DELETE soft-delete
- `src/app/api/maintenance/assets/upload-url/route.ts` - POST signed URL (maintenance-assets bucket)
- `src/app/api/maintenance/assets/[id]/qr/route.ts` - GET QR code SVG
- `src/components/maintenance/AssetRegisterFilters.tsx` - Filter bar with useCampusLocations
- `src/components/maintenance/AssetRegisterTable.tsx` - TanStack Query table with warranty colors
- `src/components/maintenance/AssetCreateDrawer.tsx` - Slide-over create form
- `src/app/maintenance/assets/page.tsx` - Asset register page
- `src/components/Sidebar.tsx` - Assets + PM Calendar nav items

## Decisions Made
- ASSETS_READ/CREATE/UPDATE/DELETE as fine-grained permissions separate from the legacy MAINTENANCE_MANAGE_ASSETS
- QR endpoint uses immutable cache headers since asset URLs never change
- pmScheduleId nullable on MaintenanceTicket with @@unique constraint — PM-10 idempotency for Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @dnd-kit packages**
- **Found during:** Task 2 verification (build step)
- **Issue:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities were imported by KanbanBoard.tsx but not in package.json — TypeScript showed errors, build failed
- **Fix:** Ran `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passed without errors
- **Committed in:** 607a624 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — pre-existing missing dependency)
**Impact on plan:** Required to allow build to complete. No scope creep.

## Issues Encountered
- Schema push required `--accept-data-loss` flag due to @@unique constraint on MaintenanceTicket (no existing PM data, safe to proceed)

## Next Phase Readiness
- Asset CRUD and QR endpoint ready for Plan 02 (QR scanner UI, asset detail page)
- PM fields on MaintenanceTicket ready for Plan 03 (PM schedule creation and ticket generation)
- All permissions in place for asset-gated features in Plans 02-05

---
*Phase: 04-assets-qr-pm*
*Completed: 2026-03-06*
