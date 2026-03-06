---
phase: 04-assets-qr-pm
plan: 04
subsystem: api, services, ui
tags: [cron, pm-schedule, checklist, framer-motion, tanstack-query, zod, prisma]

# Dependency graph
requires:
  - phase: 04-assets-qr-pm
    plan: 01
    provides: MaintenanceTicket PM fields (pmScheduleId, pmChecklistItems, pmChecklistDone, pmScheduledDueDate), unique constraint
  - phase: 04-assets-qr-pm
    plan: 03
    provides: PmSchedule CRUD, computeNextDueDate, pmScheduleService.ts

provides:
  - generatePmTickets(): cron-callable function that auto-creates TODO tickets for due PM schedules
  - PATCH /api/maintenance/tickets/[id]/checklist: toggle individual checklist items
  - QA transition gate: server-side enforcement that all PM checklist items are done before QA
  - nextDueDate recalculation: on DONE transition, cycles PM schedule forward from completion date
  - PmChecklistSection.tsx: checklist UI with progress bar, optimistic toggle, QA gate feedback
  - PM Schedule badge in TicketDetailPage header

affects:
  - cron/maintenance-tasks: extended with PM ticket generation as Task 0
  - maintenanceTicketService: QA gate + DONE recalculation added to transitionTicketStatus

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy import pattern in maintenanceTicketService: `import('@/lib/services/pmScheduleService')` avoids circular dependency since pmScheduleService imports maintenanceTicketService for generateTicketNumber
    - Optimistic UI rollback pattern in PmChecklistSection: snapshot prevDone, apply optimistic update, rollback on error
    - PM cron idempotency: Prisma P2002 unique constraint error silently skipped — duplicate runs safe

key-files:
  created:
    - src/app/api/maintenance/tickets/[id]/checklist/route.ts
    - src/components/maintenance/PmChecklistSection.tsx
  modified:
    - src/lib/services/pmScheduleService.ts (generatePmTickets, assetCategoryToSpecialty, getOrgFirstUserId)
    - src/lib/services/maintenanceTicketService.ts (QA gate, DONE recalculation, date-fns import)
    - src/app/api/cron/maintenance-tasks/route.ts (Task 0: PM ticket generation)
    - src/components/maintenance/TicketDetailPage.tsx (PmChecklistSection, PM badge, QA pre-check)

decisions:
  - "Lazy import for pmScheduleService in maintenanceTicketService.DONE handler — avoids circular dependency (pmScheduleService imports generateTicketNumber from maintenanceTicketService)"
  - "rawPrisma used in generatePmTickets — cron iterates all orgs, no org context available"
  - "submittedById fallback: when PM schedule has no defaultTechnicianId, getOrgFirstUserId() fetches any active user in the org rather than leaving NULL (NOT NULL constraint)"
  - "PM checklist gate on QA transition: both client-side (blocks modal open) and server-side (throws CHECKLIST_INCOMPLETE) — server is authoritative, client improves UX"
  - "nextDueDate recalculates from completion date (today), not pmScheduledDueDate — ensures PM cycles advance from when work was actually done"

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 4 Plan 04: PM Engine — Cron, Checklist Gate, and Schedule Cycling

**PM cron auto-generates TODO tickets with checklists for due schedules; QA gate enforces all items done; schedule cycles forward from actual completion date**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-03-06
- **Tasks:** 2
- **Files modified/created:** 6

## Accomplishments

- `generatePmTickets()` in pmScheduleService: queries all active schedules where `nextDueDate <= today + advanceNoticeDays`, creates MaintenanceTicket rows (status=TODO, checklist populated), catches P2002 unique constraint errors silently for idempotency
- Extended `/api/cron/maintenance-tasks` as Task 0 before existing scheduled/stale tasks; non-fatal — other tasks continue even if PM generation fails
- QA transition gate in `transitionTicketStatus`: when `ticket.pmScheduleId != null && pmChecklistItems.length > 0`, throws `CHECKLIST_INCOMPLETE` if `!pmChecklistDone.every(Boolean)` — server-side, cannot be bypassed
- DONE transition recalculation: lazy-imports `computeNextDueDate`, updates `pmSchedule.nextDueDate` and `lastCompletedDate` from completion date
- `PATCH /api/maintenance/tickets/[id]/checklist`: validates index bounds, permission MAINTENANCE_CLAIM or MAINTENANCE_ASSIGN, returns updated arrays
- `PmChecklistSection.tsx`: progress bar (emerald-500), per-item checkboxes with optimistic toggle + rollback, green "All items complete" banner, emerald accent border when partially done
- `TicketDetailPage.tsx`: PM Schedule badge in header (links to /maintenance/pm-calendar), checklist section between issue details and assignment, QA button pre-check with red error banner, `localChecklistDone` state syncs live from checklist toggles

## Task Commits

1. **Task 1: PM cron engine, QA checklist gate, and next-due-date recalculation** - `ab91203` (feat)
2. **Task 2: PM checklist UI on ticket detail page** - `2470f8c` (feat)

## Files Created/Modified

- `src/lib/services/pmScheduleService.ts` — generatePmTickets(), assetCategoryToSpecialty(), getOrgFirstUserId()
- `src/lib/services/maintenanceTicketService.ts` — QA gate + DONE PM recalculation + date-fns import
- `src/app/api/cron/maintenance-tasks/route.ts` — Task 0: PM ticket generation with count logging
- `src/app/api/maintenance/tickets/[id]/checklist/route.ts` — PATCH checklist toggle endpoint (new)
- `src/components/maintenance/PmChecklistSection.tsx` — Checklist UI component (new)
- `src/components/maintenance/TicketDetailPage.tsx` — PM badge, PmChecklistSection, QA gate pre-check

## Decisions Made

- Lazy import to resolve circular dependency between pmScheduleService and maintenanceTicketService
- rawPrisma in generatePmTickets (no org context available in cron context)
- submittedById fallback to any active org user when no default technician set (NOT NULL constraint)
- Client + server dual enforcement on QA gate (server authoritative, client improves UX)
- Schedule cycles from actual completion date, not scheduled date (PM intent: advance from when work done)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular dependency between pmScheduleService and maintenanceTicketService**
- **Found during:** Task 1 (code writing)
- **Issue:** pmScheduleService.generatePmTickets() needed maintenanceTicketService.generateTicketNumber(); maintenanceTicketService.DONE handler needed pmScheduleService.computeNextDueDate() — direct import would create a circular dependency
- **Fix:** Used dynamic `import()` in maintenanceTicketService's DONE handler for lazy loading; generateTicketNumber is imported at the top of pmScheduleService.ts (no circularity because it's a utility function, not a module that imports back)
- **Outcome:** Both directions work without circular import issue

**2. [Rule 1 - Bug] TypeScript errors in checklist route and pmScheduleService**
- **Found during:** Task 1 (npx tsc --noEmit)
- **Issue 1:** `ZodError.errors` does not exist — correct property is `.issues`
- **Issue 2:** `assetCategoryToSpecialty()` returns `string`, not `MaintenanceSpecialty` enum type
- **Fix:** Changed `.errors[0]` to `.issues[0]`; added `as any` cast for specialty field in rawPrisma.create
- **Verification:** `npx tsc --noEmit` passes clean

---

**Total deviations:** 2 auto-fixed (bugs caught by TypeScript)
**Impact on plan:** Fixes were inline during Task 1 verification; no scope changes

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/app/api/maintenance/tickets/[id]/checklist/route.ts` | FOUND |
| `src/components/maintenance/PmChecklistSection.tsx` | FOUND |
| Commit ab91203 (Task 1) | FOUND |
| Commit 2470f8c (Task 2) | FOUND |
