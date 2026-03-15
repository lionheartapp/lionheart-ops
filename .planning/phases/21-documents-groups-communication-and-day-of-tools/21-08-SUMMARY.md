---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "08"
subsystem: api
tags: [check-in, incidents, qr-code, offline-sync, events, ferpa, prisma, day-of-operations]

requires:
  - phase: 21-01
    provides: EventCheckIn and EventIncident Prisma models, EVENTS_CHECKIN_MANAGE and EVENTS_INCIDENTS_MANAGE permissions
provides:
  - eventCheckInService: checkIn, undoCheckIn, getCheckInCounter, getCheckInStatus, getParticipantByRegistration, syncOfflineCheckIns
  - eventIncidentService: createIncident, updateIncident, listIncidents, getIncident, deleteIncident, syncOfflineIncidents
  - GET/POST/PUT /api/events/projects/[id]/check-in (counter, check-in, offline sync)
  - GET/DELETE /api/events/projects/[id]/check-in/[registrationId] (participant info, undo)
  - GET/POST/PUT /api/events/projects/[id]/incidents (list, log, offline sync)
  - GET/PUT/DELETE /api/events/projects/[id]/incidents/[incidentId] (single incident CRUD)
  - GET /api/events/check-in/[registrationId] PUBLIC participant self-service endpoint
affects:
  - Phase 21 plans 09-10 (UI for day-of operations will consume these endpoints)
  - Any mobile/PWA offline sync implementation

tech-stack:
  added: []
  patterns:
    - Upsert-with-alreadyCheckedIn flag pattern for idempotent check-in operations
    - Medical access gating via can() check before rawPrisma query (boolean param to service function)
    - Offline sync via PUT endpoints with syncedAt timestamp
    - Public endpoint using registrationId-as-access-token (FERPA-safe: no medical data ever)
    - Middleware public path registration for /api/events/check-in/

key-files:
  created:
    - src/lib/services/eventCheckInService.ts
    - src/lib/services/eventIncidentService.ts
    - src/app/api/events/projects/[id]/check-in/route.ts
    - src/app/api/events/projects/[id]/check-in/[registrationId]/route.ts
    - src/app/api/events/projects/[id]/incidents/route.ts
    - src/app/api/events/projects/[id]/incidents/[incidentId]/route.ts
    - src/app/api/events/check-in/[registrationId]/route.ts
  modified:
    - src/middleware.ts (added /api/events/check-in/ to public paths)

key-decisions:
  - "Medical data gated by can(userId, EVENTS_MEDICAL_READ) check inside route handler — boolean includeMedical param passed to service keeps service layer pure and testable"
  - "Public participant self-service endpoint uses registrationId as access token (non-guessable cuid) — same pattern as portal magic links, no auth complexity needed"
  - "Offline sync endpoints use PUT on collection route (not a separate /sync path) — aligns with RESTful conventions and keeps route nesting simple"
  - "undoCheckIn uses deleteMany not deleteUnique — avoids error if record was never created (idempotent undo)"

requirements-completed: [QR-01, QR-02, QR-03, QR-05]

duration: 6min
completed: 2026-03-15
---

# Phase 21 Plan 08: Day-of Operations Backend Summary

**QR check-in service with live counter, participant flash card, medical gating, incident CRUD with participant involvement, offline sync endpoints, and FERPA-safe public QR self-service endpoint**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-15T23:14:43Z
- **Completed:** 2026-03-15T23:19:55Z
- **Tasks:** 2
- **Files modified:** 8 (2 services, 5 routes, 1 middleware)

## Accomplishments

- Full check-in service: upsert with alreadyCheckedIn flag, live counter (checkedIn/total), full status list sorted by recency, offline PWA sync
- Comprehensive participant lookup for QR scan: groups, schedule blocks, announcements (filtered by audience and group membership), check-in status, medical gating via permission check
- Incident service: structured logging with EventIncidentType/Severity enums, participant involvement via junction table, optional filters, reporter name enrichment
- 5 API route files covering QR-01, QR-02, QR-03, QR-05 with Zod validation, permission checks, and offline sync
- Public self-service endpoint at /api/events/check-in/[registrationId] with FERPA compliance (never returns medical data)

## Task Commits

1. **Task 1: Create check-in and incident services** - `c55c3f6` (feat)
2. **Task 2: Create check-in, incident, and participant self-service API routes** - `6d4079d` (feat)

## Files Created/Modified

- `src/lib/services/eventCheckInService.ts` — checkIn, undoCheckIn, getCheckInCounter, getCheckInStatus, getParticipantByRegistration, syncOfflineCheckIns
- `src/lib/services/eventIncidentService.ts` — createIncident, updateIncident, listIncidents, getIncident, deleteIncident, syncOfflineIncidents
- `src/app/api/events/projects/[id]/check-in/route.ts` — GET counter (?full=true for list), POST check-in, PUT offline sync
- `src/app/api/events/projects/[id]/check-in/[registrationId]/route.ts` — GET participant info (medical gated), DELETE undo
- `src/app/api/events/projects/[id]/incidents/route.ts` — GET list (filterable), POST create (201), PUT offline sync
- `src/app/api/events/projects/[id]/incidents/[incidentId]/route.ts` — GET, PUT update, DELETE
- `src/app/api/events/check-in/[registrationId]/route.ts` — PUBLIC participant self-service (QR-03)
- `src/middleware.ts` — Added /api/events/check-in/ to isPublicPath()

## Decisions Made

- Medical data gated by `can(userId, EVENTS_MEDICAL_READ)` inside route handler — boolean `includeMedical` param passed to `getParticipantByRegistration` keeps service layer pure and testable independent of HTTP context
- Public participant self-service endpoint uses registrationId (cuid) as access token — non-guessable, same pattern as portal magic links, no auth complexity needed for QR-03 requirement
- Offline sync endpoints use PUT on collection route rather than a separate /sync path — aligns with RESTful conventions and keeps route nesting simple
- `undoCheckIn` uses `deleteMany` not `deleteUnique` — idempotent undo that doesn't error if record was never created

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma enum type error for AnnouncementAudience in check-in service**
- **Found during:** Task 1 — TypeScript compile pass
- **Issue:** `{ audience: 'ALL' }` in rawPrisma.eventAnnouncement.findMany where clause gave TS2322 — Prisma expects enum type not literal string
- **Fix:** Imported `AnnouncementAudience` from `@prisma/client` and used `AnnouncementAudience.ALL` / `AnnouncementAudience.GROUP`
- **Files modified:** src/lib/services/eventCheckInService.ts
- **Verification:** npx tsc --noEmit shows 0 errors in eventCheckInService.ts
- **Committed in:** c55c3f6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Minor type correction, no scope change.

## Issues Encountered

None — plan executed as specified after the enum type fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Check-in and incident backend fully ready for Phase 21 plan 09/10 UI work
- Public QR endpoint ready for QR code generation and PWA integration
- Offline sync endpoints ready for Dexie-based PWA implementation
- Medical data gating pattern established for FERPA compliance

## Self-Check: PASSED

All artifacts verified:
- [x] src/lib/services/eventCheckInService.ts — FOUND
- [x] src/lib/services/eventIncidentService.ts — FOUND
- [x] src/app/api/events/projects/[id]/check-in/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/check-in/[registrationId]/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/incidents/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/incidents/[incidentId]/route.ts — FOUND
- [x] src/app/api/events/check-in/[registrationId]/route.ts — FOUND
- [x] 21-08-SUMMARY.md — FOUND
- [x] Commit c55c3f6 — FOUND (Task 1: services)
- [x] Commit 6d4079d — FOUND (Task 2: routes)
- [x] npx tsc --noEmit — 1 error (pre-existing test file, unrelated to this plan)
- [x] Middleware public path — /api/events/check-in/ registered
- [x] Public endpoint returns NO medical data (FERPA compliant)
- [x] Offline sync endpoints exist for check-ins (PUT) and incidents (PUT)

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
