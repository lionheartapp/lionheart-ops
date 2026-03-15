---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "06"
subsystem: api
tags: [prisma, typescript, zod, resend, events, announcements, surveys, presence]

requires:
  - phase: 21-01
    provides: EventAnnouncement, EventSurvey, EventSurveyResponse, EventPresenceSession, EventGroupAssignment, EventDocumentCompletion models + AnnouncementAudience/SurveyStatus enums + EVENTS_ANNOUNCEMENTS_MANAGE/EVENTS_SURVEYS_MANAGE/EVENT_PROJECT_READ permissions

provides:
  - eventAnnouncementService: createAnnouncement (audience targeting + email delivery), listAnnouncements, deleteAnnouncement, getAnnouncementsForRegistration
  - eventSurveyService: createSurvey, updateSurvey, deleteSurvey, listSurveys, submitSurveyResponse, getSurveyResults
  - eventPresenceService: updatePresence (heartbeat upsert), getActiveUsers (2-min threshold), removePresence
  - GET/POST/DELETE /api/events/projects/[id]/announcements (staff, EVENTS_ANNOUNCEMENTS_MANAGE)
  - GET/POST/PUT/DELETE /api/events/projects/[id]/surveys (staff, EVENTS_SURVEYS_MANAGE)
  - GET+POST /api/events/projects/[id]/surveys/[surveyId]/responses (GET=staff, POST=public)
  - GET/POST/DELETE /api/events/projects/[id]/presence (EVENT_PROJECT_READ)
  - GET /api/registration/[id]/announcements (public, parent portal, audience-filtered)

affects:
  - Plan 07 (real-time presence UI uses getActiveUsers)
  - Plan 08+ (parent portal uses getAnnouncementsForRegistration, submitSurveyResponse)

tech-stack:
  added: []
  patterns:
    - Fire-and-forget email delivery via Promise.allSettled (errors logged but do not fail the main operation)
    - Audience targeting query pattern (resolve ALL/GROUP/INCOMPLETE_DOCS/PAID_ONLY via rawPrisma before emailing)
    - Heartbeat upsert pattern using Prisma @@unique compound key (eventProjectId_userId)
    - 2-minute active threshold for presence (lastSeenAt > now - 2min)
    - Public survey response route validates survey.eventProjectId === registration.eventProjectId to prevent cross-event injection

key-files:
  created:
    - src/lib/services/eventAnnouncementService.ts
    - src/lib/services/eventSurveyService.ts
    - src/lib/services/eventPresenceService.ts
    - src/app/api/events/projects/[id]/announcements/route.ts
    - src/app/api/events/projects/[id]/surveys/route.ts
    - src/app/api/events/projects/[id]/surveys/[surveyId]/responses/route.ts
    - src/app/api/events/projects/[id]/presence/route.ts
    - src/app/api/registration/[id]/announcements/route.ts
  modified: []

key-decisions:
  - "Survey response POST is public (no staff auth) — registration ID is the access credential, validated against survey.eventProjectId"
  - "Announcement email delivery is fire-and-forget via Promise.allSettled — Resend errors are logged but do not fail the create operation"
  - "Presence route uses lightweight EVENT_PROJECT_READ permission (not a dedicated presence permission) — any staff with project read access can update presence"
  - "rawPrisma used for recipient resolution in announcements (runs outside org context in background async) — service is org-context-safe because announcement create runs inside runWithOrgContext"

patterns-established:
  - "Audience targeting: resolve recipient IDs via rawPrisma then fire-and-forget emails with Promise.allSettled"
  - "Presence heartbeat: upsert on @@unique([eventProjectId, userId]) — no separate insert/update branching needed"
  - "Survey results aggregation: detect type by value shape (array or string = choices, other = text) for dynamic field aggregation without schema knowledge"

requirements-completed: [COM-01, COM-02, COM-04, COM-05]

duration: 5min
completed: "2026-03-15"
---

# Phase 21 Plan 06: Communication, Survey, and Presence Summary

**Event announcement service with 4-audience targeting and Resend email delivery, post-event survey service reusing the form builder with response aggregation, and DB-backed presence heartbeat service — with 5 API routes covering staff and parent-portal access.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T23:14:43Z
- **Completed:** 2026-03-15T23:19:53Z
- **Tasks:** 2
- **Files modified:** 8 created

## Accomplishments

- Announcement service resolves 4 audience types (ALL, GROUP, INCOMPLETE_DOCS, PAID_ONLY) via DB queries and sends fire-and-forget Resend emails to each recipient
- Survey service validates survey lifecycle (DRAFT→ACTIVE→CLOSED), enforces `closesAt`, prevents duplicate responses, and aggregates results by field type
- Presence service uses a single `upsert` on the `@@unique([eventProjectId, userId])` compound key for efficient heartbeats
- Parent portal announcement endpoint (`/api/registration/[id]/announcements`) filters by audience — parents only see what they're targeted for
- Survey response endpoint is intentionally public: registration ID as access credential, validated against survey's eventProjectId

## Task Commits

Each task was committed atomically:

1. **Task 1: Create announcement, survey, and presence services** - `e6cba4f` (feat)
2. **Task 2: Create communication, survey, and presence API routes** - `2bdb772` (feat)

## Files Created/Modified

- `src/lib/services/eventAnnouncementService.ts` - Announcement CRUD, audience targeting, email delivery via Resend
- `src/lib/services/eventSurveyService.ts` - Survey CRUD, response submission validation, results aggregation
- `src/lib/services/eventPresenceService.ts` - Presence heartbeat upsert, active user query (2-min window), remove on leave
- `src/app/api/events/projects/[id]/announcements/route.ts` - GET/POST/DELETE staff announcements
- `src/app/api/events/projects/[id]/surveys/route.ts` - GET/POST/PUT/DELETE surveys (admin-only via SURVEYS_MANAGE)
- `src/app/api/events/projects/[id]/surveys/[surveyId]/responses/route.ts` - GET (staff aggregated), POST (public parent portal)
- `src/app/api/events/projects/[id]/presence/route.ts` - GET/POST/DELETE presence heartbeat (EVENT_PROJECT_READ)
- `src/app/api/registration/[id]/announcements/route.ts` - Public parent portal announcement endpoint

## Decisions Made

- **Survey POST is public** — registration ID is the access credential. Service validates `registration.eventProjectId === survey.eventProjectId` to prevent cross-event injection.
- **Announcement emails are fire-and-forget** — `Promise.allSettled` handles all recipients; individual failures are logged without failing the main create operation.
- **Presence uses `EVENT_PROJECT_READ`** — a dedicated presence permission would be redundant since any staff who can read an event project should be able to broadcast their presence.
- **rawPrisma for recipient resolution** — the announcement email background async runs outside the `runWithOrgContext` callback (by design — it's a fire-and-forget side effect), so it uses rawPrisma directly with explicit `eventProjectId` scoping.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed `z.record(z.unknown())` type error in survey responses route**
- **Found during:** Task 2 TypeScript check
- **Issue:** Zod v3 `z.record()` requires 2 arguments (key schema + value schema) when used with `z.unknown()` for value
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** `src/app/api/events/projects/[id]/surveys/[surveyId]/responses/route.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors in new files
- **Committed in:** 2bdb772 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed `avatarUrl` → `avatar` field name on User model**
- **Found during:** Task 1 — field discovery in Prisma schema
- **Issue:** User model uses `avatar` not `avatarUrl`
- **Fix:** Updated all select statements in announcement and presence services
- **Files modified:** `eventAnnouncementService.ts`, `eventPresenceService.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** e6cba4f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered

None — pre-existing TypeScript errors in `eventGroupService.ts` (from an earlier plan run) appeared in the initial TSC scan but are unrelated to this plan's changes. Our 8 new files produce zero TypeScript errors.

## Self-Check: PASSED

All artifacts verified:
- [x] `src/lib/services/eventAnnouncementService.ts` — FOUND
- [x] `src/lib/services/eventSurveyService.ts` — FOUND
- [x] `src/lib/services/eventPresenceService.ts` — FOUND
- [x] `src/app/api/events/projects/[id]/announcements/route.ts` — FOUND
- [x] `src/app/api/events/projects/[id]/surveys/route.ts` — FOUND
- [x] `src/app/api/events/projects/[id]/surveys/[surveyId]/responses/route.ts` — FOUND
- [x] `src/app/api/events/projects/[id]/presence/route.ts` — FOUND
- [x] `src/app/api/registration/[id]/announcements/route.ts` — FOUND
- [x] Commit e6cba4f — FOUND (services)
- [x] Commit 2bdb772 — FOUND (routes)
- [x] `npx tsc --noEmit` — Only pre-existing error in `__tests__/lib/assistant-prompt.test.ts` (unrelated)

## Next Phase Readiness

- COM-01, COM-02, COM-04, COM-05 requirements complete
- Plan 07 (real-time presence UI) can use `getActiveUsers` as its data source
- Parent portal announcement GET is live at `/api/registration/[id]/announcements`
- Survey response submission available publicly at `/api/events/projects/[id]/surveys/[surveyId]/responses`

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
