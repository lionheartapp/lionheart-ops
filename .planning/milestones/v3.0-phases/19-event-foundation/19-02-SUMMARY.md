---
phase: 19-event-foundation
plan: "02"
subsystem: api
tags: [prisma, zod, typescript, event-project, service-layer, activity-log, calendar-bridge]

dependency_graph:
  requires:
    - phase: 19-01
      provides: EventProject/EventSeries/EventTask/EventScheduleBlock/EventActivityLog models + enums + permissions
  provides:
    - Zod schemas for all EventProject domain objects (create + update variants)
    - eventProjectService with full CRUD, approval workflow, CalendarEvent bridge creation, activity log
    - eventSeriesService with CRUD and spawnProjectFromSeries
    - planningSeasonService.bulkPublish migrated from direct CalendarEvent to EventProject
  affects:
    - 19-03 (API routes call these services)
    - 19-04 (Event project API routes)
    - 19-05 (UI reads from these services via API)
    - 19-06 (series management UI)

tech-stack:
  added: []
  patterns:
    - "Append-only activity log: appendActivityLog called after every mutation — 12 call sites in eventProjectService"
    - "CalendarEvent bridge pattern: confirmEventProject creates CalendarEvent with sourceModule='event-project'"
    - "Three-source EventProject creation: DIRECT_REQUEST=PENDING_APPROVAL, SERIES/PLANNING_SUBMISSION=auto-confirmed"
    - "Org-scoped prisma client cast as any for extension models"

key-files:
  created:
    - src/lib/types/event-project.ts
    - src/lib/services/eventProjectService.ts
    - src/lib/services/eventSeriesService.ts
  modified:
    - src/lib/services/planningSeasonService.ts

key-decisions:
  - "DIRECT_REQUEST creates EventProject with PENDING_APPROVAL status; admin must approve before CalendarEvent bridge is created"
  - "PLANNING_SUBMISSION and SERIES sources auto-confirm via internal confirmEventProject call — no separate approval step"
  - "bulkPublish now returns { submissionId, eventProjectId, calendarEventId } — calendarEventId may be null if no calendar exists"
  - "Resource requests in bulkPublish attach to the CalendarEvent bridge (backward compatibility); eventProjectId stored in request details for traceability"
  - "confirmEventProject falls back to first active org calendar when project.calendarId is null; logs warning and skips bridge if no calendar exists"
  - "Schedule blocks are hard-deleted (not soft-deleted) — they are schedule data within a project, not audit-trail-sensitive records"

patterns-established:
  - "Service layer pattern: services use prisma (org-scoped) cast as any; routes call services inside runWithOrgContext"
  - "Activity log contract: every mutation function must end with appendActivityLog call before returning"
  - "Bridge record pattern: EventProject.confirmEventProject creates CalendarEvent with sourceModule='event-project' + sourceId=project.id"

requirements-completed: [EVNT-01, EVNT-02, EVNT-03, EVNT-07, EVNT-08]

duration: ~3min
completed: "2026-03-15"
---

# Phase 19 Plan 02: Service Layer Summary

**EventProject service layer with 3-source creation, CalendarEvent bridge, immutable activity log (12 call sites), EventSeries CRUD with spawn, and bulkPublish migrated from direct CalendarEvent to EventProject.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-15T03:45:05Z
- **Completed:** 2026-03-15T03:48:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created complete Zod validation layer for all EventProject domain objects (8 schemas, create + update for EventProject, ScheduleBlock, EventTask, EventSeries)
- Built eventProjectService with 14 exports covering full CRUD, approval workflow, CalendarEvent bridge creation, and activity log — every mutation appends an immutable log entry (12 call sites)
- Built eventSeriesService with full CRUD + spawnProjectFromSeries that merges series defaults with caller overrides
- Migrated planningSeasonService.bulkPublish from direct CalendarEvent creation to EventProject-based flow, preserving resource request backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod schemas/types and EventProject service with activity logging** - `9d2a3a7` (feat)
2. **Task 2: Create EventSeries service and modify bulkPublish to create EventProjects** - `88561cc` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/types/event-project.ts` - 8 Zod schemas with inferred TypeScript types for all EventProject domain inputs
- `src/lib/services/eventProjectService.ts` - Full EventProject CRUD, approval workflow, CalendarEvent bridge, schedule block CRUD, task CRUD, activity log queries
- `src/lib/services/eventSeriesService.ts` - EventSeries CRUD + spawnProjectFromSeries
- `src/lib/services/planningSeasonService.ts` - bulkPublish migrated to createEventProject; resource requests attach to CalendarEvent bridge

## Decisions Made

- DIRECT_REQUEST source creates PENDING_APPROVAL status; PLANNING_SUBMISSION and SERIES auto-confirm on creation
- confirmEventProject creates CalendarEvent with `sourceModule: 'event-project'` — this is the canonical bridge record pattern
- bulkPublish now returns `{ submissionId, eventProjectId, calendarEventId }` instead of `{ submissionId, eventId }`
- Resource requests in bulkPublish store `eventProjectId` in details field for traceability while still attaching to CalendarEvent bridge for backward compatibility
- Schedule blocks are hard-deleted (no soft-delete): they are schedule data within a project, not records requiring audit trail preservation
- confirmEventProject falls back to first active calendar when `project.calendarId` is null; skips bridge with warning log if no calendar exists (graceful degradation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Service layer complete and verified via import checks + TypeScript compilation
- API routes (Plan 03/04) can now call these services inside `runWithOrgContext`
- All exported functions match the expected signatures documented in Plan 03's context section

---
*Phase: 19-event-foundation*
*Completed: 2026-03-15*
