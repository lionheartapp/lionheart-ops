---
phase: 29-auto-channels-system-bot-and-integrations
plan: 02
subsystem: api
tags: [messaging, auto-channels, system-bot, hooks, fire-and-forget]

requires:
  - phase: 29-01
    provides: autoChannelService and systemBotService functions
provides:
  - Auto-channel creation on team creation
  - Auto-channel archival on team deletion
  - Team and school channel member sync on user updates
  - Bot posting on ticket, event, and maintenance lifecycle events
affects: [messaging, settings, tickets, events, maintenance]

tech-stack:
  added: []
  patterns:
    - "Fire-and-forget bot posting with .catch(() => {})"
    - "Lazy import() for optional service hooks in maintenanceTicketService"
    - "Pre-fetch old team IDs before atomic membership replace for sync"

key-files:
  created: []
  modified:
    - src/app/api/settings/teams/route.ts
    - src/app/api/settings/teams/[id]/route.ts
    - src/app/api/settings/users/[id]/route.ts
    - src/lib/services/ticketService.ts
    - src/lib/services/eventService.ts
    - src/lib/services/maintenanceTicketService.ts

key-decisions:
  - "Event bot post wired to createEvent since Event model has no status update flow -- events are CONFIRMED on creation"
  - "Event schoolId passed as null since Event model lacks schoolId field -- bot post is a no-op until schoolId is added"
  - "Maintenance team lookup uses slug 'maintenance' from DEFAULT_TEAMS to find Facility Maintenance team channel"

patterns-established:
  - "Phase 29 hooks: all auto-channel/bot integrations are try/catch wrapped and never block the response"

requirements-completed: [INT-01, INT-02, INT-03]

duration: 8min
completed: 2026-05-07
---

# Phase 29 Plan 02: Integration Hooks Summary

**Wired auto-channel sync and system bot posting into team CRUD, user updates, and ticket/event/maintenance service lifecycle hooks**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-07T22:15:50Z
- **Completed:** 2026-05-07T22:24:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Team creation triggers auto-channel creation; team deletion archives the auto-channel
- User team membership changes sync all affected team auto-channels
- User schoolId changes sync old and new school auto-channels
- Ticket status changes post bot messages to assigned team's auto-channel
- Maintenance ticket creation and status transitions post to Facility Maintenance auto-channel

## Task Commits

1. **Task 1: Wire auto-channel sync into team and user routes** - `d8a386b` (feat)
2. **Task 2: Wire bot posting into ticket, event, and maintenance services** - `5bca251` (feat)

## Files Created/Modified
- `src/app/api/settings/teams/route.ts` - Added createTeamChannel + getOrCreateBotUser on POST
- `src/app/api/settings/teams/[id]/route.ts` - Added auto-channel archive on DELETE
- `src/app/api/settings/users/[id]/route.ts` - Added syncTeamMembers on team change, syncSchoolMembers on schoolId change
- `src/lib/services/ticketService.ts` - Added postTicketStatusChange in updateTicket
- `src/lib/services/eventService.ts` - Added postEventApproval in createEvent
- `src/lib/services/maintenanceTicketService.ts` - Added postMaintenanceAlert in createMaintenanceTicket and transitionTicketStatus

## Decisions Made
- Event model has no APPROVED status (uses DRAFT/CONFIRMED/CANCELLED). Wired bot post to createEvent since events are created as CONFIRMED. The postEventApproval call passes null for schoolId since Event has no schoolId field, making it a no-op until that field is added.
- Maintenance team channel lookup uses the well-known "maintenance" slug from DEFAULT_TEAMS rather than trying to resolve from ticket specialty.
- Old team IDs are captured before the atomic deleteMany+createMany transaction so sync covers both removed and added teams.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Event approval hook location**
- **Found during:** Task 2
- **Issue:** Plan suggested hooking into updateEvent with status check, but UpdateEventSchema has no status field. Status changes happen through cancelEvent or submitDraftEvent.
- **Fix:** Moved hook to createEvent (where events become CONFIRMED) and removed the status check from updateEvent.
- **Files modified:** src/lib/services/eventService.ts
- **Committed in:** 5bca251

**2. [Rule 1 - Bug] Fixed TypeScript type error in channel query**
- **Found during:** Task 1
- **Issue:** Using `Record<string, unknown>` as findFirst argument caused TS2345 type mismatch.
- **Fix:** Used the same unknown-cast pattern from autoChannelService.ts for channel queries with non-standard fields.
- **Files modified:** src/app/api/settings/teams/[id]/route.ts
- **Committed in:** d8a386b

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Known Stubs
- Event bot post passes `null` for schoolId -- will become active when Event model gains schoolId field.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All integration hooks wired. Auto-channels sync on team/user mutations. Bot posts on ticket/event/maintenance lifecycle.
- Event schoolId integration will need wiring when Event model is updated.

---
*Phase: 29-auto-channels-system-bot-and-integrations*
*Completed: 2026-05-07*

## Self-Check: PASSED
