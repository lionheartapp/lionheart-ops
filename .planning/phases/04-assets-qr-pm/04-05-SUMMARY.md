---
phase: 04-assets-qr-pm
plan: 05
subsystem: api
tags: [labor-tracking, cost-tracking, prisma, tanstack-query, framer-motion, supabase-storage, maintenance]

# Dependency graph
requires:
  - phase: 04-assets-qr-pm plan 01
    provides: MaintenanceLaborEntry + MaintenanceCostEntry + TechnicianProfile schema models with loadedHourlyRate

provides:
  - laborCostService.ts with full CRUD + cost aggregation + vendor autocomplete
  - 11 API routes for labor/cost entries, receipt upload, and vendor list
  - LaborTimerButton (start/stop timer with localStorage persistence)
  - LaborEntryForm (manual time entry with start/end or duration-only mode)
  - CostEntryForm (vendor autocomplete, amount, receipt photo upload)
  - LaborCostSummaryCards (4-card glassmorphism summary: hours + 3 cost totals)
  - LaborCostPanel (collapsible right-column panel wired into TicketDetailPage)

affects: [05-analytics, 06-fci, ticket-detail-page, pm-scheduling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "localStorage timer pattern: ticketId-keyed timer state persists across navigation"
    - "Vendor autocomplete: useQuery with ?q= param, dropdown closes on outside click"
    - "Receipt upload: signed URL pattern identical to maintenance-assets (bypass 1MB limit)"
    - "Cost summary: getCostSummary joins labor+cost tables, computes all 4 totals in one call"
    - "rawPrisma for all labor/cost service functions (not inside runWithOrgContext) — routes call service inside runWithOrgContext"

key-files:
  created:
    - src/lib/services/laborCostService.ts
    - src/app/api/maintenance/tickets/[id]/labor/route.ts
    - src/app/api/maintenance/tickets/[id]/labor/[entryId]/route.ts
    - src/app/api/maintenance/tickets/[id]/costs/route.ts
    - src/app/api/maintenance/tickets/[id]/costs/[entryId]/route.ts
    - src/app/api/maintenance/tickets/[id]/cost-upload-url/route.ts
    - src/app/api/maintenance/vendors/route.ts
    - src/components/maintenance/LaborTimerButton.tsx
    - src/components/maintenance/LaborEntryForm.tsx
    - src/components/maintenance/CostEntryForm.tsx
    - src/components/maintenance/LaborCostSummaryCards.tsx
    - src/components/maintenance/LaborCostPanel.tsx
  modified:
    - src/components/maintenance/TicketDetailPage.tsx
    - src/app/api/maintenance/tickets/[id]/route.ts

key-decisions:
  - "rawPrisma used throughout laborCostService (not org-scoped client) — routes wrap calls in runWithOrgContext for scoping"
  - "getCostSummary joins both tables in one call via Promise.all, computes laborCost per entry using tech's loadedHourlyRate"
  - "Timer state stored in localStorage keyed by ticketId; resumes on navigation back (survives page refresh)"
  - "costs GET route accepts ?summary=true to return entries + summary in one request, reducing LaborCostPanel fetch count"
  - "LaborTimerButton only shown on IN_PROGRESS tickets for privileged non-submitter users; LaborCostPanel visible on all statuses"
  - "MAINTENANCE_CLAIM permission guards all labor/cost routes — same as other tech-facing endpoints"

patterns-established:
  - "Pattern: Cost summary computed server-side not client-side — avoids precision errors from JS float arithmetic"
  - "Pattern: ?summary=true query param on cost entries GET avoids extra round-trip for panel initial load"

requirements-completed: [LABOR-01, LABOR-02, LABOR-03, LABOR-04, LABOR-05, LABOR-06, LABOR-07]

# Metrics
duration: 30min
completed: 2026-03-06
---

# Phase 4 Plan 5: Labor & Cost Tracking Summary

**Start/stop labor timer with localStorage persistence, manual time entry, vendor autocomplete, receipt photo upload, and 4-card cost summary panel wired into ticket detail right column**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-06T22:00:00Z
- **Completed:** 2026-03-06T22:30:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Full labor and cost CRUD service with getCostSummary aggregation (totalLaborHours, laborCost, materialsCost, grandTotal) using each technician's loadedHourlyRate
- 11 API routes covering labor CRUD, cost CRUD, receipt signed URL, and vendor autocomplete with ?q= prefix filter
- LaborTimerButton with localStorage persistence across navigation and elapsed time counter with animate-pulse; creates labor entry on stop
- LaborCostPanel collapsible right-column panel following the AIDiagnosticPanel expand/collapse pattern with AnimatePresence animations

## Task Commits

1. **Task 1: Labor/cost service, all API routes, and vendor autocomplete** - `9b87fa6` (feat)
2. **Task 2: Timer button, entry forms, summary cards, and cost panel on ticket detail** - `978ab5c` (feat)

## Files Created/Modified

- `src/lib/services/laborCostService.ts` - Labor/cost CRUD + getCostSummary + getVendorList
- `src/app/api/maintenance/tickets/[id]/labor/route.ts` - GET list + POST create
- `src/app/api/maintenance/tickets/[id]/labor/[entryId]/route.ts` - PATCH update + DELETE
- `src/app/api/maintenance/tickets/[id]/costs/route.ts` - GET list + POST create (with ?summary=true)
- `src/app/api/maintenance/tickets/[id]/costs/[entryId]/route.ts` - PATCH update + DELETE
- `src/app/api/maintenance/tickets/[id]/cost-upload-url/route.ts` - Signed URL for maintenance-receipts bucket
- `src/app/api/maintenance/vendors/route.ts` - Distinct vendor autocomplete with ?q= filter
- `src/components/maintenance/LaborTimerButton.tsx` - Start/stop timer with localStorage + elapsed display
- `src/components/maintenance/LaborEntryForm.tsx` - Manual time entry (start/end or duration mode)
- `src/components/maintenance/CostEntryForm.tsx` - Vendor autocomplete + amount + receipt photo upload
- `src/components/maintenance/LaborCostSummaryCards.tsx` - 4 glassmorphism gradient cards
- `src/components/maintenance/LaborCostPanel.tsx` - Collapsible panel with both entry lists and forms
- `src/components/maintenance/TicketDetailPage.tsx` - Added LaborTimerButton to header, LaborCostPanel to right column
- `src/app/api/maintenance/tickets/[id]/route.ts` - Added estimatedRepairCostUSD to PATCH allowed fields

## Decisions Made

- `rawPrisma` used in service layer (labor/cost models are not in the orgScopedModels extension list) — routes provide org scoping via `runWithOrgContext`
- getCostSummary computed server-side to avoid JS float precision errors for Phase 6 FCI calculations
- `?summary=true` on costs GET route avoids extra network round trip for panel's initial load
- Timer button only visible on IN_PROGRESS tickets; cost panel visible on all statuses so closed-ticket costs are always accessible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added estimatedRepairCostUSD to PATCH route**
- **Found during:** Task 1 (verifying plan requirement 6 — field exists on schema but route didn't expose it)
- **Issue:** Plan required verifying the PATCH route handled estimatedRepairCostUSD; it did not
- **Fix:** Added estimatedRepairCostUSD to the allowed PATCH fields in /api/maintenance/tickets/[id]/route.ts
- **Files modified:** src/app/api/maintenance/tickets/[id]/route.ts
- **Verification:** TypeScript check passes, field now accepted in PATCH body
- **Committed in:** 9b87fa6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical field in existing PATCH route)
**Impact on plan:** Essential for Phase 6 FCI data collection. No scope creep.

## Issues Encountered

- Pre-existing build failure: `src/app/maintenance/pm-calendar/page.tsx` imports server-only `org-context.ts` (pulls `node:async_hooks`) into a client component chain via `pmScheduleService.ts`. This is an untracked file from earlier phase-4 work — out of scope for this plan. Logged to deferred items.

## User Setup Required

None — no external service configuration required beyond what was set up in Plan 01 (Supabase Storage, which this plan reuses via the existing `maintenance-receipts` bucket path pattern).

## Next Phase Readiness

- Labor and cost data is fully persisted and queryable — Phase 5 analytics can aggregate these tables
- getCostSummary already returns the 4 values needed for Phase 6 FCI deferred maintenance cost calculations
- estimatedRepairCostUSD on open tickets now accessible via PATCH, supporting Phase 6 deferred maintenance projections

---
*Phase: 04-assets-qr-pm*
*Completed: 2026-03-06*
