---
phase: 04-assets-qr-pm
plan: 03
subsystem: api, ui, services
tags: [prisma, nextjs, tanstack-query, framer-motion, react-big-calendar, date-fns, zod]

# Dependency graph
requires:
  - phase: 04-assets-qr-pm
    plan: 01
    provides: MaintenanceAsset CRUD, PmSchedule schema, ASSETS_READ/CREATE/UPDATE/DELETE permissions

provides:
  - PM schedule CRUD API (GET list, GET detail, POST create, PATCH update, DELETE)
  - GET /api/maintenance/pm-schedules?view=calendar&start=&end= calendar event projection
  - computeNextDueDate for all 8 recurrence types (DAILY/WEEKLY/BIWEEKLY/MONTHLY/QUARTERLY/SEMIANNUAL/ANNUAL/CUSTOM)
  - PmScheduleWizard: 5-step creation wizard with checklist reorder, month picker, avoidSchoolYear toggle
  - PmCalendarView: react-big-calendar month/week view with color-coded events
  - PmScheduleList: sortable table with status badges and due date highlighting
  - PM calendar page at /maintenance/pm-calendar with calendar/list toggle and inline wizard
  - src/lib/types/pm-schedule.ts: client-safe PM types and constants

affects:
  - 04-04 (labor tracking may reference PM-generated tickets)
  - 04-05 (cost analytics can query PM-linked tickets)

# Tech tracking
tech-stack:
  added:
    - react-big-calendar (already installed, first use in maintenance module)
    - date-fns/locale/en-US (for react-big-calendar localizer)
  patterns:
    - Client-safe type extraction: server-only service exports duplicated into src/lib/types/ to prevent node:async_hooks from leaking into client bundles
    - Zod schema split: base schema without .refine() allows .partial() for update schemas; create schema adds refinement on top
    - PM calendar uses react-big-calendar with custom event renderer (PmCalendarEvent) and injected CSS overrides for glassmorphism theme

key-files:
  created:
    - src/lib/services/pmScheduleService.ts
    - src/lib/types/pm-schedule.ts
    - src/app/api/maintenance/pm-schedules/route.ts
    - src/app/api/maintenance/pm-schedules/[id]/route.ts
    - src/components/maintenance/PmScheduleWizard.tsx
    - src/components/maintenance/PmScheduleList.tsx
    - src/components/maintenance/PmCalendarView.tsx
    - src/components/maintenance/PmCalendarEvent.tsx
    - src/app/maintenance/pm-calendar/page.tsx
  modified:
    - src/lib/services/maintenanceNotificationService.ts (room type: name/code → roomNumber/displayName)
    - src/lib/services/maintenanceTicketService.ts (room include: name/code → roomNumber/displayName)
    - src/app/api/cron/maintenance-tasks/route.ts (room select corrected for notification service type)

key-decisions:
  - "Client-safe types in src/lib/types/pm-schedule.ts — importing pmScheduleService.ts in client components pulls node:async_hooks via @/lib/db, crashing Next.js webpack build. Solution: duplicate constants/interfaces into a client-safe types file."
  - "Zod base schema + refine separation — UpdatePmScheduleSchema.partial() throws at runtime ('cannot use .partial() on schema with refinements'). Solution: PmScheduleBaseSchema (no refine) used for .partial(), CreatePmScheduleSchema adds .refine() on top."
  - "avoidSchoolYear stored as boolean, displayed with '(enforcement coming soon)' note — deferred per plan requirement PM-05."
  - "computeNextDueDate for MONTHLY with months array finds next matching month after baseDate's month, wrapping to next year if needed — matches expected calendar behavior."

patterns-established:
  - "Client-safe types pattern: server-only service types duplicated into src/lib/types/*.ts when needed by client components"
  - "PM calendar color coding: blue=upcoming, red=overdue (nextDueDate < today), green=completed (future)"
  - "react-big-calendar theming: inject <style> tag inside wrapper div to override rbc-* classes without global CSS pollution"

requirements-completed: [PM-01, PM-02, PM-03, PM-04, PM-05, PM-09]

# Metrics
duration: 16min
completed: 2026-03-06
---

# Phase 4 Plan 03: PM Schedules Summary

**PM schedule CRUD with computeNextDueDate for 8 recurrence types, react-big-calendar month/week view with color-coded events, 5-step creation wizard, and sortable list view at /maintenance/pm-calendar**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-06T15:02:47Z
- **Completed:** 2026-03-06T15:19:03Z
- **Tasks:** 2
- **Files modified/created:** 11

## Accomplishments
- PM schedule service with full CRUD, `computeNextDueDate` handles all 8 recurrence types including MONTHLY with specific month arrays
- REST API: GET/POST /pm-schedules + calendar mode (?view=calendar&start=&end=), GET/PATCH/DELETE /pm-schedules/[id]
- PmScheduleWizard: 5-step wizard (Name, Recurrence, Checklist, Asset/Location, Technician) with animated step transitions, month picker, checklist reorder with up/down arrows, avoidSchoolYear toggle with deferred enforcement note
- PmCalendarView: react-big-calendar with month/week toggle, color-coded events (blue=upcoming, red=overdue), glassmorphism CSS overrides
- PM calendar page at /maintenance/pm-calendar: calendar/list toggle with AnimatePresence tab animation, inline wizard with slide-in/out, success toast on creation

## Task Commits

1. **Task 1: PM schedule service and API routes** - `ac95963` (feat)
2. **Task 2: PM schedule wizard, calendar view, list view, and PM calendar page** - `99d17c7` (feat)

## Files Created/Modified
- `src/lib/services/pmScheduleService.ts` - Full CRUD, computeNextDueDate, calendar event projection
- `src/lib/types/pm-schedule.ts` - Client-safe PM constants and types (avoids server module leak)
- `src/app/api/maintenance/pm-schedules/route.ts` - GET list + calendar mode, POST create
- `src/app/api/maintenance/pm-schedules/[id]/route.ts` - GET detail, PATCH update, DELETE
- `src/components/maintenance/PmScheduleWizard.tsx` - 5-step creation wizard
- `src/components/maintenance/PmCalendarView.tsx` - react-big-calendar month/week view
- `src/components/maintenance/PmCalendarEvent.tsx` - Custom event renderer with color dots
- `src/components/maintenance/PmScheduleList.tsx` - Sortable table with status/due date
- `src/app/maintenance/pm-calendar/page.tsx` - Calendar/list toggle page with inline wizard
- `src/lib/services/maintenanceNotificationService.ts` - Room type corrected (roomNumber/displayName)
- `src/lib/services/maintenanceTicketService.ts` - Room include corrected (roomNumber/displayName)
- `src/app/api/cron/maintenance-tasks/route.ts` - Room select matches notification service type

## Decisions Made
- Client-safe types extracted into `src/lib/types/pm-schedule.ts` to prevent `node:async_hooks` from entering client bundles via `@/lib/db`
- Zod schema split into base + refine layers to allow `.partial()` on update schema
- `avoidSchoolYear` stored and displayed per plan, enforcement deferred until SchoolCalendar model exists
- `computeNextDueDate` for MONTHLY with months array wraps to next year's first matching month when no later month exists in same year

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Client-safe type extraction for PM constants**
- **Found during:** Task 2 (build verification)
- **Issue:** Importing `pmScheduleService.ts` in client components (`PmCalendarView`, `PmScheduleWizard`, `PmScheduleList`) caused webpack build error: `node:async_hooks` not handled by plugins — the service imports `@/lib/db` which uses `AsyncLocalStorage`
- **Fix:** Created `src/lib/types/pm-schedule.ts` with duplicated constants/interfaces safe for client use; updated client components to import from types file
- **Files modified:** src/lib/types/pm-schedule.ts (created), all 4 client components updated
- **Verification:** Build passed
- **Committed in:** 99d17c7 (Task 2 commit)

**2. [Rule 1 - Bug] Zod `.partial()` crash on refined schema**
- **Found during:** Task 2 (build verification — page data collection)
- **Issue:** `CreatePmScheduleSchema.partial()` threw at runtime: ".partial() cannot be used on object schemas containing refinements"
- **Fix:** Split schema into `PmScheduleBaseSchema` (no refine, used for `.partial()`) and `CreatePmScheduleSchema` (adds `.refine()` for CUSTOM validation)
- **Files modified:** src/lib/services/pmScheduleService.ts
- **Verification:** Build passed, page data collected successfully
- **Committed in:** 99d17c7 (Task 2 commit)

**3. [Rule 1 - Bug] Room fields wrong in maintenanceNotificationService and maintenanceTicketService**
- **Found during:** Task 2 (build — type checking stage)
- **Issue:** `maintenanceNotificationService.ts` typed room as `{ name: string; code?: string | null }` and `maintenanceTicketService.ts` selected `room: { id, name, code }` — but Room model has `roomNumber` and `displayName`, not `name`/`code`. This was a pre-existing error blocking the build.
- **Fix:** Updated TicketSnapshot type to `{ roomNumber: string; displayName?: string | null }`, updated `locationString()` to use `displayName || roomNumber`, corrected room include in ticketService and cron route
- **Files modified:** src/lib/services/maintenanceNotificationService.ts, src/lib/services/maintenanceTicketService.ts, src/app/api/cron/maintenance-tasks/route.ts
- **Verification:** TypeScript passes, build passes
- **Committed in:** 99d17c7 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs in new code, 1 pre-existing bug blocking build)
**Impact on plan:** All fixes were required for build to pass. No scope creep. The room field fix was a pre-existing Phase 02 inconsistency that manifested during this plan's build verification.

## Issues Encountered
- React-big-calendar required injected `<style>` tag inside the wrapper div to override `rbc-*` CSS classes without polluting global stylesheet — this approach avoids CSS module conflicts while allowing glassmorphism theme customization
- Multiple consecutive `npm run build` runs in Next.js 15 can produce "manifest not found" errors on second run; resolved by using `rm -rf .next` before building cleanly

## Next Phase Readiness
- PM schedule CRUD and calendar ready for Plan 04 (labor tracking) which may reference PM-linked tickets
- `computeNextDueDate` exported from service — ready for future cron job that generates PM tickets
- `pmScheduleId` / `pmScheduledDueDate` on MaintenanceTicket (from Plan 01) ready for PM ticket generation cron (Plan 06 or later)

---
*Phase: 04-assets-qr-pm*
*Completed: 2026-03-06*
