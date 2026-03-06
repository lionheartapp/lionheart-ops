---
phase: 02-core-tickets
plan: "03"
subsystem: ui
tags: [react, tanstack-query, framer-motion, maintenance, work-orders, tailwind]

requires:
  - phase: 02-core-tickets/02-01
    provides: All maintenance ticket API endpoints including GET /api/maintenance/tickets, POST /api/maintenance/tickets/[id]/claim, PATCH /api/maintenance/tickets/[id]/status, GET /api/maintenance/dashboard

provides:
  - WorkOrdersFilters component with 7 filter controls and debounced search
  - WorkOrdersTable with sortable columns, inline quick action menus, specialty highlighting, mobile card view
  - WorkOrdersView container with TanStack Query, optimistic claim, collapsible scheduled section
  - MaintenanceDashboard wired to live /api/maintenance/dashboard data with AnimatedCounter stat cards
  - Work Orders tab in maintenance page now shows full WorkOrdersView (replaced placeholder)

affects:
  - 02-04 (any future maintenance UI plans)
  - 03-kanban (Kanban board will reuse WorkOrdersTable patterns)

tech-stack:
  added: []
  patterns:
    - "Optimistic mutation pattern: onMutate (snapshot + patch cache) -> onError (rollback) -> onSettled (invalidate) for claim action"
    - "excludeStatus query param used to split main tickets vs. scheduled tickets into two separate queries"
    - "RowActionMenu: inline ... button opens dropdown with Claim/Assign/Change Status modes, each with sub-form in same popover"
    - "Specialty highlighting: canClaim && !canManage enables tech view; matchesSpecialty===false rows get opacity-50 when showAll toggle is on"

key-files:
  created:
    - src/components/maintenance/WorkOrdersFilters.tsx
    - src/components/maintenance/WorkOrdersTable.tsx
    - src/components/maintenance/WorkOrdersView.tsx
  modified:
    - src/app/maintenance/page.tsx
    - src/components/maintenance/MaintenanceDashboard.tsx

key-decisions:
  - "Separate main and scheduled TanStack Query keys: main uses excludeStatus=SCHEDULED, scheduled query uses status=SCHEDULED — avoids a single large query having to client-side filter"
  - "Technicians dropdown in WorkOrdersFilters populated from /api/settings/users (all members) when canAssign — future improvement would be a dedicated technicians endpoint"
  - "Dashboard rewrote Recent Activity and Technician Workload panels as static empty states (those are Phase 3+ features) rather than wiring fake data"
  - "Status bar chart uses relative percentages (count / maxStatusCount) so bars are proportional even when counts are small"

patterns-established:
  - "WorkOrdersFilters: controlled component with all state in parent (WorkOrdersView), onChange callback pattern"
  - "Two-query split: main active tickets (excludeStatus=SCHEDULED) + dedicated scheduled query for collapsible section"
  - "Optimistic claim: cache snapshot stored in onMutate context, rolled back on error, invalidated on settled"

requirements-completed:
  - ROUTE-05
  - LIFE-01
  - LIFE-07

duration: 6min
completed: 2026-03-06
---

# Phase 2 Plan 3: Work Orders Table and Live Dashboard Summary

**Filterable sortable Work Orders table with optimistic claim, specialty highlighting, collapsible scheduled section, and MaintenanceDashboard wired to live API stats**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-06T02:53:44Z
- **Completed:** 2026-03-06T03:00:00Z
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint)
- **Files created/modified:** 5

## Accomplishments

- WorkOrdersFilters: 7 controls (status, priority, category, campus, technician, keyword with 300ms debounce, unassigned toggle) with Clear Filters button
- WorkOrdersTable: sortable ticket #/priority/age columns, `...` row action menus (Claim, Assign, Change Status with sub-forms), ui-glass-table on desktop + mobile card view, opacity-50 specialty highlighting
- WorkOrdersView: TanStack Query with two queries (main excl. SCHEDULED, scheduled-only), optimistic claim mutation with snapshot rollback, "Show all" specialty toggle for tech role, collapsible Scheduled section with Framer Motion expandCollapse
- MaintenanceDashboard: now fetches live `/api/maintenance/dashboard` data; stat cards use AnimatedCounter; status bar chart shows real proportional bars; urgent/overdue alerts panel shows real counts; error state with Retry button; loading skeleton

## Task Commits

1. **Task 1: Work Orders table with filters, sorting, claim, scheduled section** - `2171db9` (feat)
2. **Task 2: Wire Work Orders tab and live dashboard stats** - `12ee4eb` (feat)

## Files Created/Modified

- `src/components/maintenance/WorkOrdersFilters.tsx` — Filter bar with 7 controls, clear button, debounced search
- `src/components/maintenance/WorkOrdersTable.tsx` — Sortable table + RowActionMenu + mobile card view + ScheduledTicketsTable
- `src/components/maintenance/WorkOrdersView.tsx` — Container with TanStack Query, optimistic mutations, specialty toggle, scheduled collapsible
- `src/app/maintenance/page.tsx` — Replaced work-orders placeholder with WorkOrdersView component
- `src/components/maintenance/MaintenanceDashboard.tsx` — Wired to live dashboard API, real stat cards, status bar chart, alerts panel

## Decisions Made

- Separate TanStack Query keys for main vs. scheduled tickets: `['maintenance-tickets', filters, 'exclude-scheduled']` and `['maintenance-tickets-scheduled']`. Keeps scheduled section independent so toggling filters on main table doesn't affect the scheduled collapsible.
- Technicians for Assign dropdown populated from `/api/settings/users` when `canAssign` is true. A future dedicated technicians endpoint would be cleaner.
- Optimistic claim uses `onMutate` to snapshot and patch cache with placeholder `{ id: '__optimistic__', firstName: 'You', lastName: '' }` then rolls back on error — user sees instant feedback.
- Dashboard "Recent Activity" and "Technician Workload" panels stay as static empty states — these are Phase 3+ features.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Work Orders table is the maintenance team's primary working view — ready for human verification
- MaintenanceDashboard is wired to live data — will show real stats once tickets are created
- Kanban board (Phase 3) can build on WorkOrdersTable column patterns and the same API contracts

---
*Phase: 02-core-tickets*
*Completed: 2026-03-06*
