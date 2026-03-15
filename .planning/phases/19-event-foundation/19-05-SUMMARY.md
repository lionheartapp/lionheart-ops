---
phase: 19-event-foundation
plan: 05
subsystem: ui
tags: [react, tanstack-query, framer-motion, date-fns, events, schedule, tasks]

# Dependency graph
requires:
  - phase: 19-04
    provides: useEventProject, useEventSchedule, useEventTasks hooks and TanStack Query integration
  - phase: 19-03
    provides: EventProject API routes, schedule/task/series endpoints
  - phase: 19-01
    provides: EventProject Prisma schema, enums (EventScheduleBlockType, EventTaskStatus, EventTaskPriority)

provides:
  - Events list page at /events with project cards, filter chips, create/series buttons
  - EventProject 8-tab workspace at /events/[id] with Overview, Schedule, Tasks functional
  - EventScheduleTab: day-by-day block builder with add/edit/delete, type badges (EVNT-05)
  - EventTasksTab: task list with status toggles, priority badges, filters, progress bar (EVNT-06)
  - EventActivityLog: chronological activity feed with actor avatars
  - CreateEventProjectModal: new event with dates, location, attendance
  - EventSeriesDrawer: RRULE builder for recurring series creation (EVNT-02 entry point)
  - CalendarEvent deep-link to /events/[sourceId] via View Event Project button (EVNT-08)
  - 5 empty-state shell tabs (People, Documents, Logistics, Budget, Comms) as future-phase placeholders
affects:
  - 19-06
  - 20-registration
  - 21-logistics
  - 22-communications

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 8-tab workspace layout with animated aurora gradient indicator using useRef + getBoundingClientRect
    - URL persistence for active tab via searchParams (tab=schedule, tab=tasks, etc.)
    - Day-by-day schedule grouping using date-fns format + reduce
    - Inline expand/collapse for block and task editing with AnimatePresence height animation
    - Status cycle pattern: TODO -> IN_PROGRESS -> DONE (BLOCKED -> TODO) via click
    - RRULE builder UI: frequency + days + end condition → RFC 5545 string generation
    - Empty-state tabs as "Show Everything" design — describe future capabilities, not error states
    - Client-side task filtering with priority + status chips
    - Progress bar via linear-gradient aurora for completed/total tasks

key-files:
  created:
    - src/app/events/page.tsx
    - src/app/events/[id]/page.tsx
    - src/components/events/EventProjectTabs.tsx
    - src/components/events/EventOverviewTab.tsx
    - src/components/events/EventScheduleTab.tsx
    - src/components/events/EventTasksTab.tsx
    - src/components/events/EventActivityLog.tsx
    - src/components/events/CreateEventProjectModal.tsx
    - src/components/events/EventPeopleTab.tsx
    - src/components/events/EventDocumentsTab.tsx
    - src/components/events/EventLogisticsTab.tsx
    - src/components/events/EventBudgetTab.tsx
    - src/components/events/EventCommsTab.tsx
    - src/components/events/EventSeriesDrawer.tsx
  modified:
    - src/components/calendar/EventDetailPanel.tsx
    - src/lib/hooks/useCalendar.ts

key-decisions:
  - "EventProjectTabs persists active tab via URL searchParams so deep-links work"
  - "EventScheduleTab groups blocks by date using format(parseISO(block.startsAt), 'yyyy-MM-dd') as key"
  - "EventTasksTab filters client-side — no re-fetch on filter change since task lists are small"
  - "EventSeriesDrawer inlines its own mutation hook (no separate useEventSeries hook file needed at this phase)"
  - "5 empty-state tabs receive eventProjectId prop for future-phase use but show descriptive placeholders now"
  - "CalendarEventData.sourceModule and sourceId added as optional fields to support deep-link detection"

patterns-established:
  - "Inline edit pattern: click expand arrow, Edit button reveals inline form, Save closes form"
  - "Status toggle with loading: disabled state + Loader2 spinner while mutation pending"
  - "Block type badges: color-coded pill (SESSION=blue, ACTIVITY=green, MEAL=amber, FREE_TIME=gray, TRAVEL=purple, SETUP=orange)"
  - "Priority badge: CRITICAL=red, HIGH=orange, NORMAL=blue, LOW=gray"
  - "RRULE preview in real-time: buildRRule() called on every render, shows constructed string"

requirements-completed: [EVNT-02, EVNT-04, EVNT-05, EVNT-06, EVNT-08, EVNT-09]

# Metrics
duration: ~45min
completed: 2026-03-15
---

# Phase 19 Plan 05: Events UI — List, Workspace, Schedule, Tasks, Series Drawer Summary

**Events list page + 8-tab EventProject workspace with functional Schedule (EVNT-05) and Tasks (EVNT-06) tabs, RRULE-based series drawer (EVNT-02), and calendar-to-EventProject deep-link (EVNT-08)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-15T04:03:04Z
- **Completed:** 2026-03-15T04:50:00Z
- **Tasks:** 3/3 auto tasks complete (Task 4 is checkpoint:human-verify, awaiting verification)
- **Files modified:** 16

## Accomplishments

- Events list page at /events with filter chips (All/Draft/Pending/Confirmed/In Progress/Completed), project cards, skeleton loading, empty state with CTA
- EventProject 8-tab workspace with animated aurora gradient tab indicator, URL persistence, AnimatePresence crossfade between tabs
- EventScheduleTab: day-by-day block grouping, add/edit/delete with inline forms, type badges, skeleton loading
- EventTasksTab: status toggles (TODO→IN_PROGRESS→DONE), priority badges, client-side filters, progress bar, inline edit/delete
- EventActivityLog: chronological feed with actor avatars, type badges, formatDistanceToNow timestamps
- CreateEventProjectModal: title/description/dates/multi-day toggle/location/attendance fields with Zod validation
- EventSeriesDrawer: RRULE builder (frequency, day-of-week checkboxes, day-of-month, end condition), default schedule fields, real-time RRULE preview
- CalendarEvent deep-link: "View Event Project" button appears for events with sourceModule='event-project'
- 5 empty-state shell tabs: People, Documents, Logistics, Budget, Comms — each with icon, heading, description, phase badge

## Task Commits

1. **Task 1: Events list page, 8-tab workspace, tabs, overview, schedule, tasks, activity log, create modal** - `0e02b8c` (feat)
2. **Task 2: 5 empty-state shell tabs for future phases** - `ef1971a` (feat)
3. **Task 3: EventSeriesDrawer + calendar deep-link + wire series button** - `91d0b45` (feat)

**Plan metadata:** *(pending final commit after verification)*

## Files Created/Modified

- `src/app/events/page.tsx` — Events list page with filter chips, project cards, create modal, series drawer
- `src/app/events/[id]/page.tsx` — EventProject workspace with header, approve button, back nav, 8-tab layout
- `src/components/events/EventProjectTabs.tsx` — 8-tab container with animated aurora indicator, URL persistence
- `src/components/events/EventOverviewTab.tsx` — Quick stats grid, event details, status timeline, activity preview
- `src/components/events/EventScheduleTab.tsx` — Day-by-day schedule builder with add/edit/delete blocks (EVNT-05)
- `src/components/events/EventTasksTab.tsx` — Task list with status toggles, priority badges, filters, progress bar (EVNT-06)
- `src/components/events/EventActivityLog.tsx` — Chronological activity feed with actor avatars and type badges
- `src/components/events/CreateEventProjectModal.tsx` — New event project modal with multi-day toggle
- `src/components/events/EventPeopleTab.tsx` — Empty state placeholder for Registration phase
- `src/components/events/EventDocumentsTab.tsx` — Empty state placeholder for Documents phase
- `src/components/events/EventLogisticsTab.tsx` — Empty state placeholder for Groups phase
- `src/components/events/EventBudgetTab.tsx` — Empty state placeholder for Budget phase
- `src/components/events/EventCommsTab.tsx` — Empty state placeholder for Communications phase
- `src/components/events/EventSeriesDrawer.tsx` — RRULE builder drawer for recurring series (EVNT-02 UI)
- `src/components/calendar/EventDetailPanel.tsx` — Added "View Event Project" deep-link (EVNT-08)
- `src/lib/hooks/useCalendar.ts` — Added sourceModule + sourceId optional fields to CalendarEventData

## Decisions Made

- EventProjectTabs persists active tab via URL searchParams so deep-links work correctly
- EventScheduleTab groups blocks by date using `format(parseISO(block.startsAt), 'yyyy-MM-dd')` as map key
- EventTasksTab filters client-side — no re-fetch needed since task lists are small per event
- EventSeriesDrawer inlines its own TanStack mutation hook; no separate useEventSeries hook file needed at this phase
- CalendarEventData.sourceModule and sourceId added as optional fields to support deep-link detection without breaking existing event types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CreateEventTaskInput requiring 'status' field**
- **Found during:** Task 1 (EventTasksTab creation)
- **Issue:** TypeScript error — CreateEventTaskInput requires `status` field per Zod schema, but the form omits it since new tasks always start as TODO
- **Fix:** Added `status: 'TODO'` explicitly to the create payload
- **Files modified:** src/components/events/EventTasksTab.tsx
- **Verification:** tsc --noEmit passes with no errors in our files
- **Committed in:** 0e02b8c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Trivial fix, no scope change.

## Issues Encountered

None — plan executed smoothly. Pre-existing test file TS error in `__tests__/lib/assistant-prompt.test.ts` is unrelated to this plan (out-of-scope, not touched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 requirements (EVNT-02, EVNT-04, EVNT-05, EVNT-06, EVNT-08, EVNT-09) covered by new UI
- Events feature is fully functional end-to-end pending human verification (Task 4)
- After verification, the Event Foundation phase (19) will be complete
- Phase 20 (Registration) can begin — Events is now the top-level frame for all school activity

---
*Phase: 19-event-foundation*
*Completed: 2026-03-15*
