---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "02"
subsystem: api
tags: [prisma, zod, email, resend, document-tracking, compliance]

requires:
  - phase: 21-01
    provides: EventDocumentRequirement, EventDocumentCompletion, EventComplianceItem models + EVENTS_DOCUMENTS_MANAGE + EVENTS_COMPLIANCE_MANAGE permissions + shared types

provides:
  - eventDocumentService.ts with 12 exported functions
  - GET/POST/PUT/DELETE /api/events/projects/[id]/documents
  - GET/PATCH /api/events/projects/[id]/documents/completions
  - POST /api/events/projects/[id]/documents/reminders
  - GET/POST/PUT/DELETE /api/events/projects/[id]/compliance

affects:
  - 21-03-PLAN (groups) — same route pattern to follow
  - 21-04-PLAN and beyond (all Phase 21 API plans)
  - UI components for document tab and compliance checklist

tech-stack:
  added: []
  patterns:
    - rawPrisma.createMany with skipDuplicates for bulk completion row seeding
    - toggleCompletion uses upsert with unique compound key (registrationId_requirementId)
    - sendDocumentReminder uses rawPrisma for cross-org email sends (outside runWithOrgContext)
    - ?defaults=true query param pattern for returning static defaults without DB query
    - DELETE routes support both query param and JSON body for requirementId/itemId

key-files:
  created:
    - src/lib/services/eventDocumentService.ts
    - src/app/api/events/projects/[id]/documents/route.ts
    - src/app/api/events/projects/[id]/documents/completions/route.ts
    - src/app/api/events/projects/[id]/documents/reminders/route.ts
    - src/app/api/events/projects/[id]/compliance/route.ts
  modified: []

key-decisions:
  - "rawPrisma used inside sendDocumentReminder for eventProject/org lookups — function is called from within runWithOrgContext but needs cross-context access to send emails"
  - "createDocumentRequirement auto-seeds EventDocumentCompletion rows for all existing REGISTERED participants using rawPrisma.createMany + skipDuplicates"
  - "getDefaultComplianceChecklist is a pure function (no DB) — returns static array of 6 common off-campus items callable before runWithOrgContext"
  - "DELETE routes accept requirementId/itemId from both query param and JSON body for flexibility"
  - "Prisma client generated after Phase 21-01 schema changes — npx prisma generate required to resolve TS errors on new models"

patterns-established:
  - "Reminder email helper inlined in service (not imported from registrationEmailService) to avoid circular dependency on rawPrisma"
  - "GET /api/events/projects/[id]/documents returns both requirements array AND stats object in single response"
  - "Compliance GET with ?defaults=true returns static list without DB hit — useful for import-defaults UX"

requirements-completed: [DOC-01, DOC-02, DOC-03]

duration: 4min
completed: 2026-03-15
---

# Phase 21 Plan 02: Document Tracking and Compliance Summary

**eventDocumentService + 4 API routes covering document requirements, per-participant completion matrix, targeted reminder emails, and off-campus compliance checklist with defaults import.**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-03-15T23:14:28Z
- **Completed:** 2026-03-15T23:18:00Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

- Service layer with 12 functions: document CRUD, completion matrix, reminder email dispatch, compliance CRUD, static defaults
- Per-participant completion matrix via getDocumentMatrix — returns requirements + participant completions in a single query-efficient response
- Targeted HTML reminder emails via Resend/SMTP with inline email template (no circular deps)
- Compliance defaults import pattern: GET ?defaults=true returns 6 static items (liability insurance, vehicle inspection, driver background checks, vendor contracts, venue safety cert, emergency action plan)
- Auto-seeding of EventDocumentCompletion rows on createDocumentRequirement using rawPrisma.createMany + skipDuplicates

## Task Commits

1. **Task 1: Create document and compliance service layer** - `cfb901f` (feat)
2. **Task 2: Create document and compliance API routes** - `2a2f7c2` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/services/eventDocumentService.ts` — 12 exported functions for document requirements, completion matrix, reminder emails, compliance checklist
- `src/app/api/events/projects/[id]/documents/route.ts` — GET (requirements + stats) / POST (create) / PUT (update) / DELETE (delete) with Zod validation
- `src/app/api/events/projects/[id]/documents/completions/route.ts` — GET (full matrix) / PATCH (toggle single completion)
- `src/app/api/events/projects/[id]/documents/reminders/route.ts` — POST (send reminder emails to incomplete families)
- `src/app/api/events/projects/[id]/compliance/route.ts` — GET (?defaults=true supported) / POST / PUT / DELETE with Zod validation

## Decisions Made

- rawPrisma used in sendDocumentReminder for eventProject/org lookup — needed cross-context access outside runWithOrgContext
- Email helper inlined in eventDocumentService (not imported from registrationEmailService) — avoids circular dependency
- getDefaultComplianceChecklist is a pure function with no DB access — callable before runWithOrgContext, useful for ?defaults=true route
- After Phase 21-01 schema changes, `npx prisma generate` was required to generate Prisma client types for new models before TypeScript compilation succeeded

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran npx prisma generate after Phase 21-01 schema changes**
- **Found during:** Task 1 (eventDocumentService TypeScript verification)
- **Issue:** rawPrisma.eventDocumentCompletion and rawPrisma.eventDocumentRequirement showed TS2339 errors — Prisma client had not been regenerated after Phase 21-01 added 14 new models to schema.prisma
- **Fix:** Ran `npx prisma generate` to regenerate Prisma client types
- **Files modified:** node_modules/.prisma/client (generated, not committed)
- **Verification:** All TS errors in eventDocumentService resolved; only pre-existing errors remained (2 in test + survey route)
- **Committed in:** cfb901f (resolved before commit)

---

**Total deviations:** 1 auto-fixed (blocking: Prisma client not generated)
**Impact on plan:** Required fix, not scope creep. Pre-existing test/survey errors were out-of-scope and not touched.

## Issues Encountered

None beyond the Prisma generation fix documented above.

## User Setup Required

None - no external service configuration required. Email (Resend/SMTP) uses existing env vars.

## Next Phase Readiness

- Document tracking and compliance backend complete (DOC-01, DOC-02, DOC-03)
- All 4 routes follow standard pattern: getOrgIdFromRequest → getUserContext → assertCan → runWithOrgContext → service call → ok()/fail()
- Ready for Plan 03 (Groups) — same route/service pattern applies

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
