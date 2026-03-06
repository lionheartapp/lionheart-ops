---
phase: 02-core-tickets
plan: 01
subsystem: api
tags: [maintenance, tickets, state-machine, notifications, email, ai, supabase-storage, cron, prisma]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "MaintenanceTicket schema, permissions system, notification infrastructure, email system, auth middleware"
provides:
  - 8-status ticket lifecycle state machine with ALLOWED_TRANSITIONS map
  - Full ticket CRUD API (14 route files)
  - Specialty routing with self-claim guard (MAINTENANCE_CLAIM permission + TechnicianProfile.specialties check)
  - Head-of-maintenance assignment without specialty check (ROUTE-03)
  - Activity logging for every state change, comment, and assignment
  - 11 maintenance notification triggers (email + in-app, fire-and-forget)
  - 10 branded MJML email templates for maintenance lifecycle
  - AI category suggestion via Gemini vision (graceful degrade)
  - AI multi-issue detection via Gemini text (graceful degrade)
  - Dashboard aggregation API (counts by status/priority/category)
  - Hourly cron job for SCHEDULED->BACKLOG transitions and 48h stale alerts
  - staleAlertSent field on MaintenanceTicket schema
affects: [03-kanban-ui, 04-ai-diagnostics, 05-pm-scheduling, 06-compliance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State machine pattern: ALLOWED_TRANSITIONS map as Record<Status, Record<Status, TransitionConfig>> for O(1) transition lookup"
    - "Fire-and-forget notifications: dynamic import() + .catch() pattern, never await in route handlers"
    - "Role-scoped list queries: hasReadAll -> all tickets, hasClaim -> unassigned+own, else -> submittedById only"
    - "Graceful AI degradation: try/catch around all Gemini calls, return null/false on any failure"
    - "Cron security: CRON_SECRET in Authorization: Bearer header, rawPrisma for cross-org iteration"

key-files:
  created:
    - src/lib/services/maintenanceTicketService.ts
    - src/lib/services/maintenanceNotificationService.ts
    - src/app/api/maintenance/tickets/route.ts
    - src/app/api/maintenance/tickets/[id]/route.ts
    - src/app/api/maintenance/tickets/[id]/status/route.ts
    - src/app/api/maintenance/tickets/[id]/activities/route.ts
    - src/app/api/maintenance/tickets/[id]/claim/route.ts
    - src/app/api/maintenance/tickets/upload-url/route.ts
    - src/app/api/maintenance/tickets/ai-suggest-category/route.ts
    - src/app/api/maintenance/tickets/ai-detect-multi-issue/route.ts
    - src/app/api/maintenance/dashboard/route.ts
    - src/app/api/cron/maintenance-tasks/route.ts
  modified:
    - prisma/schema.prisma (staleAlertSent field)
    - src/lib/services/notificationService.ts (11 maintenance_* types)
    - src/lib/email/templates.ts (10 maintenance templates + SUBJECTS + TEXT_BODIES)
    - src/lib/services/emailService.ts (10 sendMaintenance* functions)
    - vercel.json (hourly cron)

key-decisions:
  - "Room fields are roomNumber/displayName (not name/code) — corrected all room includes in routes and service"
  - "GoogleGenAI (not GoogleGenerativeAI) is the correct import from @google/genai v1 SDK — use genai.models.generateContent() pattern"
  - "Cron uses rawPrisma (no org context) to iterate all orgs — maintenance-tasks runs across the entire platform"
  - "assignTicket has NO specialty check (ROUTE-03) — head can assign any ticket to any tech regardless of specialty"
  - "Notifications use dynamic import() for maintenanceNotificationService to avoid circular dependencies at module load time"

patterns-established:
  - "Ticket state machine: All transitions validated via ALLOWED_TRANSITIONS[currentStatus][newStatus] — 400 INVALID_TRANSITION on miss"
  - "Activity logging: Every status change, assignment, claim, and comment creates a MaintenanceTicketActivity row"
  - "Internal activity filtering: isInternal activities only shown to users with MAINTENANCE_READ_ALL or MAINTENANCE_CLAIM"

requirements-completed:
  - SUBMIT-01
  - SUBMIT-02
  - SUBMIT-03
  - SUBMIT-04
  - SUBMIT-05
  - SUBMIT-06
  - SUBMIT-07
  - SUBMIT-08
  - SUBMIT-09
  - SUBMIT-10
  - SUBMIT-11
  - LIFE-01
  - LIFE-02
  - LIFE-03
  - LIFE-04
  - LIFE-05
  - LIFE-06
  - LIFE-07
  - LIFE-08
  - ROUTE-01
  - ROUTE-02
  - ROUTE-03
  - ROUTE-04
  - DETAIL-04
  - DETAIL-05
  - NOTIF-01
  - NOTIF-02
  - NOTIF-03
  - NOTIF-04
  - NOTIF-05
  - NOTIF-06
  - NOTIF-07
  - NOTIF-08
  - NOTIF-09
  - NOTIF-10
  - NOTIF-11

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 2 Plan 1: Core Tickets Backend Summary

**8-status ticket state machine with 14 API routes, specialty routing, 11 notification triggers (email + in-app), AI diagnostics, and hourly cron for scheduled tickets and stale alerts**

## Performance

- **Duration:** 11 minutes
- **Started:** 2026-03-06T02:32:01Z
- **Completed:** 2026-03-06T02:43:38Z
- **Tasks:** 2
- **Files modified/created:** 16

## Accomplishments

- Complete ticket service layer with 8-status state machine enforcing all transitions with permission checks, required field validation, and activity logging
- 14 API route files covering full CRUD, status transitions, self-claim, photo upload, AI suggestions, dashboard, and cron
- All 11 notification triggers wired: email (Resend/SMTP) + in-app for every lifecycle event, fire-and-forget with error isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema patch, service layer, notification system, email templates** - `10b20c5` (feat)
2. **Task 2: All API routes, cron job, and vercel.json** - `ba1ddff` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

**Created:**
- `src/lib/services/maintenanceTicketService.ts` - Core service: CATEGORY_TO_SPECIALTY, ALLOWED_TRANSITIONS, generateTicketNumber, createMaintenanceTicket, transitionTicketStatus, claimTicket, assignTicket, getTicketDetail, listTickets
- `src/lib/services/maintenanceNotificationService.ts` - 7 notification dispatchers for all 11 triggers (email + in-app, fire-and-forget)
- `src/app/api/maintenance/tickets/route.ts` - POST (create) + GET (list, role-scoped)
- `src/app/api/maintenance/tickets/[id]/route.ts` - GET (detail) + PATCH (metadata/assign)
- `src/app/api/maintenance/tickets/[id]/status/route.ts` - PATCH (state machine transitions)
- `src/app/api/maintenance/tickets/[id]/activities/route.ts` - GET (filtered) + POST (comment/internal note)
- `src/app/api/maintenance/tickets/[id]/claim/route.ts` - POST (self-claim with specialty guard)
- `src/app/api/maintenance/tickets/upload-url/route.ts` - POST (signed Supabase Storage URL)
- `src/app/api/maintenance/tickets/ai-suggest-category/route.ts` - POST (Gemini vision classification)
- `src/app/api/maintenance/tickets/ai-detect-multi-issue/route.ts` - POST (Gemini multi-issue detection)
- `src/app/api/maintenance/dashboard/route.ts` - GET (aggregate stats)
- `src/app/api/cron/maintenance-tasks/route.ts` - GET (hourly: SCHEDULED->BACKLOG + stale alerts)

**Modified:**
- `prisma/schema.prisma` - Added staleAlertSent Boolean field to MaintenanceTicket
- `src/lib/services/notificationService.ts` - Extended NotificationType with 11 maintenance_* types
- `src/lib/email/templates.ts` - Added 10 maintenance MJML templates, SUBJECTS entries, TEXT_BODIES entries
- `src/lib/services/emailService.ts` - Added 10 sendMaintenance* email functions
- `vercel.json` - Added hourly cron schedule

## Decisions Made

- Room fields are `roomNumber`/`displayName` not `name`/`code` — all route includes corrected
- `GoogleGenAI` (not `GoogleGenerativeAI`) is the correct class from `@google/genai` v1 — use `genai.models.generateContent()` pattern consistent with `gemini.service.ts`
- Cron uses `rawPrisma` to iterate across all organizations (no org context needed for system-level job)
- `assignTicket` has no specialty check (ROUTE-03 requirement) — head assigns freely to any tech
- Notifications use dynamic `import()` inside service functions to avoid circular module dependencies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Room model field names**
- **Found during:** Task 2 (build verification)
- **Issue:** Plan specified `room: { select: { name: true, code: true } }` but Room model has `roomNumber` and `displayName` fields, not `name` and `code`
- **Fix:** Updated all room select clauses in maintenanceTicketService.ts, cron route, [id]/route.ts, and TicketSnapshot type in maintenanceNotificationService.ts
- **Files modified:** maintenanceTicketService.ts, maintenanceNotificationService.ts, [id]/route.ts, cron route
- **Verification:** TypeScript passes, build passes
- **Committed in:** `ba1ddff` (Task 2 commit)

**2. [Rule 1 - Bug] Corrected Gemini SDK import pattern**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Plan's prompt said to use `GoogleGenerativeAI` but the installed `@google/genai` v1 SDK exports `GoogleGenAI` and uses `genai.models.generateContent()` pattern (consistent with existing gemini.service.ts)
- **Fix:** Updated both AI route files to use `GoogleGenAI` and the correct API method
- **Files modified:** ai-suggest-category/route.ts, ai-detect-multi-issue/route.ts
- **Verification:** TypeScript passes, build passes
- **Committed in:** `ba1ddff` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes corrected field name/API mismatches. No scope creep.

## Issues Encountered

- ZodError in activities route accessed `.errors` property which doesn't exist on ZodError in this version — simplified to return generic validation message without field details

## User Setup Required

External services require manual configuration before photo uploads and cron security work:

**Supabase Storage:**
- Create `maintenance-photos` bucket in Supabase Dashboard > Storage > New bucket
- Enable public read access on the bucket

**Cron Secret:**
- Generate: `openssl rand -hex 32`
- Add `CRON_SECRET=<value>` to `.env` and Vercel environment variables
- The cron endpoint returns 401 without this

## Next Phase Readiness

All backend APIs are complete. Phase 3 (Kanban UI) can build directly on:
- `POST /api/maintenance/tickets` for ticket creation wizard
- `GET /api/maintenance/tickets` for work orders table and My Requests view
- `PATCH /api/maintenance/tickets/[id]/status` for Kanban card drag-and-drop
- `POST /api/maintenance/tickets/[id]/claim` for instant claim button
- `GET /api/maintenance/dashboard` for dashboard stat cards

No blockers for Phase 3.

---
*Phase: 02-core-tickets*
*Completed: 2026-03-06*
