---
phase: 04-assets-qr-pm
plan: 02
subsystem: ui, api, service
tags: [nextjs, tanstack-query, framer-motion, qrcode, html5-qrcode, jspdf, prisma]

# Dependency graph
requires:
  - phase: 04-assets-qr-pm
    plan: 01
    provides: MaintenanceAsset CRUD, QR SVG endpoint, AST-XXXX numbering

provides:
  - Asset detail page at /maintenance/assets/[id] with identity, cost health, ticket history, PM
  - AssetRepairGauge: green/amber/red progress bar + alert banner
  - QR scanner modal (html5-qrcode, SSR-safe dynamic import)
  - Label PDF generation (single 2x1" and Avery 5160 batch via jsPDF)
  - GET /api/maintenance/assets/[id]/label: asset data + QR base64 PNG
  - POST /api/maintenance/assets/labels: batch label data (up to 30 assets)
  - StepAsset wizard step: debounced search, manual AST-XXXX entry, skip, pre-fill
  - assetId field on MaintenanceTicket (nullable FK linking ticket to asset)

affects:
  - 04-03 (PM schedules visible on asset detail)
  - 04-04 (labor/cost entries appear in cumulative repair cost gauge)
  - 04-05 (cost analytics built on assetId FK)

# Tech tracking
tech-stack:
  added:
    - html5-qrcode 2.3.x (browser camera QR scanning)
    - jspdf 2.x (client-side PDF label generation)
  patterns:
    - QR scanner uses dynamic import with ssr=false to prevent window/navigator crash during SSR
    - Label generation is purely client-side (API returns data, client renders PDF with jsPDF)
    - Asset search in wizard uses debounced fetch (300ms) against /api/maintenance/assets?search=
    - Pre-fill from query params: assetId triggers auto-load on StepAsset mount

key-files:
  created:
    - src/components/maintenance/AssetDetailPage.tsx
    - src/components/maintenance/AssetRepairGauge.tsx
    - src/components/maintenance/QRCodeThumbnail.tsx
    - src/components/maintenance/QRScannerInner.tsx
    - src/components/maintenance/QRScannerModal.tsx
    - src/components/maintenance/SubmitRequestWizard/StepAsset.tsx
    - src/app/maintenance/assets/[id]/page.tsx
    - src/app/api/maintenance/assets/[id]/label/route.ts
    - src/app/api/maintenance/assets/labels/route.ts
    - src/lib/label-utils.ts
  modified:
    - prisma/schema.prisma (assetId nullable on MaintenanceTicket + reverse relation on MaintenanceAsset)
    - src/lib/services/maintenanceAssetService.ts (getAssetWithDetails with ticket history, PM, cumulative cost)
    - src/app/api/maintenance/assets/[id]/route.ts (use getAssetWithDetails)
    - src/components/maintenance/AssetCreateDrawer.tsx (editAsset prop for edit mode)
    - src/components/maintenance/SubmitRequestWizard.tsx (5-step wizard with StepAsset, assetId in submit)
    - src/components/maintenance/SubmitRequestWizard/StepReview.tsx (assetId/assetLabel in form data type)
    - src/lib/services/maintenanceTicketService.ts (assetId in CreateTicketSchema, stored in create)
    - src/app/maintenance/assets/page.tsx (QR scanner button wired to QRScannerModal)

key-decisions:
  - "QR scanner uses html5-qrcode (not ZXing or jsQR) for drop-in browser camera integration with viewfinder UI"
  - "Label PDF is client-side (jsPDF) — server returns JSON with QR base64 PNG, client renders. Avoids server PDF generation complexity and binary response handling."
  - "assetId is nullable on MaintenanceTicket — existing tickets unaffected, new tickets can optionally link to an asset"
  - "StepAsset is optional (has Skip button) — tickets are not required to reference an asset"
  - "Asset detail page at /maintenance/assets/[id] (not /[tenant]/maintenance) — follows actual app routing convention"

patterns-established:
  - "Report Issue from asset detail uses query params ?assetId=&buildingId=&areaId=&roomId= to pre-fill wizard"
  - "Cumulative repair cost = sum of all MaintenanceCostEntry.amount + labor cost (durationMinutes/60 * loadedHourlyRate)"
  - "Gauge color thresholds: green < 50% of threshold, amber 50-100% of threshold, red >= threshold"

requirements-completed: [ASSET-04, ASSET-05, ASSET-06, QR-02, QR-03, QR-04, QR-05]

# Metrics
duration: 45min
completed: 2026-03-06
---

# Phase 4 Plan 02: Asset Detail, QR Scanner, Label Printing, and Asset Search Summary

**Asset detail page with repair gauge, QR scanner modal, label PDF generation, and asset search step in ticket wizard**

## Performance

- **Duration:** 45 min
- **Started:** ~2026-03-06T15:05:00Z
- **Completed:** ~2026-03-06T15:50:00Z
- **Tasks:** 2
- **Files modified/created:** 20

## Accomplishments

### Task 1: Asset Detail Page with Repair Gauge

- `getAssetWithDetails()` service function fetches asset with ticket history (sorted open-first), PM schedules, and cumulative repair cost (material costs + labor cost via loadedHourlyRate)
- `AssetRepairGauge`: green/amber/red segmented progress bar with threshold marker at configured %, alert banner when cumulative >= threshold
- `QRCodeThumbnail`: lazy-loaded QR image from `/qr` endpoint, modal zoom, Print Label button triggering jsPDF generation
- `AssetDetailPage`: identity (QR + photo slot + make/model/serial/location/warranty), cost health, ticket history table (open first), PM schedule list, "Report Issue" button with pre-filled query params
- Asset detail route at `/maintenance/assets/[id]` with DashboardLayout + ModuleGate wrappers
- `AssetCreateDrawer` extended with `editAsset` prop — PATCH mode for in-place asset editing from detail page

### Task 2: QR Scanner, Label Printing, and Ticket Wizard Asset Step

- `QRScannerInner`: html5-qrcode scanner extracting asset ID from `/maintenance/assets/([^/?]+)` pattern, cleans up scanner on unmount
- `QRScannerModal`: SSR-safe wrapper using `dynamic(() => import('./QRScannerInner'), { ssr: false })` — critical to avoid window/navigator crash in Next.js
- QR scanner wired to "Scan QR" button on asset register header
- `GET /api/maintenance/assets/[id]/label`: returns `{ assetId, assetNumber, name, qrDataUrl, location }` for jsPDF rendering
- `POST /api/maintenance/assets/labels`: batch version accepting up to 30 assetIds
- `label-utils.ts`: `generateSingleLabel` (2x1" landscape) and `generateBatchLabels` (letter-size Avery 5160, 3x10 grid)
- `StepAsset`: debounced search (300ms) against assets API, dropdown with AST-XXXX + name + location, manual number entry with exact-match lookup, Skip button
- Pre-fill from query params: `?assetId=` auto-loads asset on wizard mount (from "Report Issue")
- Location auto-fill: selecting an asset auto-fills building/area/room if wizard has no location yet
- SubmitRequestWizard updated to 5 steps: Location > Asset > Photos > Details > Review
- `assetId` added to `CreateTicketSchema` and stored in `createMaintenanceTicket`

## Task Commits

1. **Task 1: Asset detail page with repair gauge, ticket history, and PM section** - `29f3751` (feat)
2. **Task 2: QR scanner, label printing, and asset search step in ticket wizard** - `300f54f` (feat)

## Files Created/Modified

**Created:**
- `src/components/maintenance/AssetDetailPage.tsx` - Full asset detail page component
- `src/components/maintenance/AssetRepairGauge.tsx` - Repair vs. replace gauge with alert
- `src/components/maintenance/QRCodeThumbnail.tsx` - QR thumbnail with modal zoom and print button
- `src/components/maintenance/QRScannerInner.tsx` - html5-qrcode browser scanner (client-only)
- `src/components/maintenance/QRScannerModal.tsx` - SSR-safe dynamic import wrapper
- `src/components/maintenance/SubmitRequestWizard/StepAsset.tsx` - Asset search step
- `src/app/maintenance/assets/[id]/page.tsx` - Asset detail page route
- `src/app/api/maintenance/assets/[id]/label/route.ts` - Single label data endpoint
- `src/app/api/maintenance/assets/labels/route.ts` - Batch label data endpoint
- `src/lib/label-utils.ts` - jsPDF single and batch label generators

**Modified:**
- `prisma/schema.prisma` - assetId nullable FK on MaintenanceTicket, tickets relation on MaintenanceAsset
- `src/lib/services/maintenanceAssetService.ts` - getAssetWithDetails() with full enrichment
- `src/app/api/maintenance/assets/[id]/route.ts` - Use getAssetWithDetails
- `src/components/maintenance/AssetCreateDrawer.tsx` - editAsset prop + PATCH mode
- `src/components/maintenance/SubmitRequestWizard.tsx` - 5-step wizard with StepAsset
- `src/components/maintenance/SubmitRequestWizard/StepReview.tsx` - Extended form data type
- `src/lib/services/maintenanceTicketService.ts` - assetId in schema + create
- `src/app/maintenance/assets/page.tsx` - QR scanner modal wired

## Decisions Made

- html5-qrcode chosen for browser QR scanning (drop-in viewfinder UI vs manual ZXing integration)
- PDF labels generated client-side with jsPDF — server returns data, avoids binary response complexity
- assetId is nullable on MaintenanceTicket — optional asset linking, backward compatible with all existing tickets
- StepAsset has a Skip button — not all tickets relate to a specific asset
- Asset detail page follows `/maintenance/assets/[id]` (not `/[tenant]/maintenance`) — consistent with actual app routing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MaintenanceTicket.status is DONE not CLOSED**
- **Found during:** Task 1 (writing filter logic in getAssetWithDetails)
- **Issue:** Plan spec said filter by "CLOSED" status but the Prisma schema uses "DONE"
- **Fix:** Used `DONE` and `CANCELLED` as closed statuses throughout
- **Files modified:** `maintenanceAssetService.ts`, `AssetDetailPage.tsx`
- **Commit:** 29f3751

**2. [Rule 3 - Blocking] git stash test reverted SubmitRequestWizard.tsx and maintenanceTicketService.ts**
- **Found during:** Task 2 (post-build test via git stash)
- **Issue:** Used `git stash` to test baseline build. Stash pop failed due to pmScheduleService.ts conflict. After dropping stash, files were reverted to committed state (losing our additions).
- **Fix:** Re-applied all changes manually (rewrote SubmitRequestWizard.tsx, re-applied assetId to ticketService)
- **Impact:** Slight time cost, no scope impact
- **Commit:** 300f54f

**3. [Rule 3 - Blocking] assets/page.tsx QR wiring lost with stash**
- **Found during:** Task 2 (post-stash verification)
- **Issue:** The QR scanner wiring done during Task 1 was part of the working tree, not staged, and was reverted when git stash was dropped
- **Fix:** Re-applied the QR scanner import and wiring
- **Commit:** 300f54f

---

**Total deviations:** 3 (1 design discrepancy, 2 tooling incidents — no scope creep)

## Build Notes

TypeScript check (`npx tsc --noEmit`) passes cleanly. `npm run build` shows "Compiled successfully" and generates all 122 static pages, but fails during "Collecting build traces" step with `ENOENT: _ssgManifest.js`. This is a pre-existing Next.js/macOS race condition issue verified to be present before these changes.

---
*Phase: 04-assets-qr-pm*
*Completed: 2026-03-06*
