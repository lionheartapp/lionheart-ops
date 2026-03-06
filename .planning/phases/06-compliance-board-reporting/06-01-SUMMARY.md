---
phase: 06-compliance-board-reporting
plan: 01
subsystem: compliance
tags: [prisma, postgresql, compliance, cron, email, tanstack-query, framer-motion, next.js]

# Dependency graph
requires:
  - phase: 05-analytics-repair-intelligence
    provides: rawPrisma cross-org patterns, emailService with maintenance email templates
  - phase: 01-foundation
    provides: Organization model, permission system, org-scoped Prisma extension, auth middleware
  - phase: 02-core-tickets
    provides: MaintenanceTicket model for compliance ticket FK relation

provides:
  - ComplianceDomainConfig and ComplianceRecord Prisma models with 3 new enums
  - complianceService.ts with domain defaults, CRUD, calendar population, and reminder dispatch
  - 6 API routes for compliance domain and record management plus populate endpoint
  - Cron endpoint /api/cron/compliance-reminders for 30-day and 7-day reminder emails
  - ComplianceDomainCard, ComplianceSetupWizard, ComplianceCalendar React components
  - Compliance management page at /maintenance/compliance
  - COMPLIANCE_READ, COMPLIANCE_MANAGE, COMPLIANCE_EXPORT permissions in DEFAULT_ROLES

affects: [06-compliance-board-reporting, 07-knowledge-base-offline-pwa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Client-safe constants pattern: server-service constants extracted to @/lib/types/compliance.ts to prevent Node.js server deps leaking into client bundles
    - Find-or-create pattern instead of upsert for nullable composite unique keys in Prisma

key-files:
  created:
    - src/lib/types/compliance.ts
    - src/lib/services/complianceService.ts
    - src/app/api/maintenance/compliance/domains/route.ts
    - src/app/api/maintenance/compliance/domains/[id]/route.ts
    - src/app/api/maintenance/compliance/domains/populate/route.ts
    - src/app/api/maintenance/compliance/records/route.ts
    - src/app/api/maintenance/compliance/records/[id]/route.ts
    - src/app/api/cron/compliance-reminders/route.ts
    - src/components/maintenance/compliance/ComplianceDomainCard.tsx
    - src/components/maintenance/compliance/ComplianceSetupWizard.tsx
    - src/components/maintenance/compliance/ComplianceCalendar.tsx
    - src/app/maintenance/compliance/page.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/permissions.ts
    - src/lib/db/index.ts
    - src/lib/services/emailService.ts
    - src/lib/services/notificationService.ts
    - src/components/Sidebar.tsx

key-decisions:
  - "Client-safe types extracted: COMPLIANCE_DOMAIN_DEFAULTS and COMPLIANCE_DOMAINS moved to @/lib/types/compliance.ts to prevent mjml/fs server deps from leaking into client bundles via import chain"
  - "Find-or-create replaces upsert for ComplianceDomainConfig: Prisma upsert on nullable composite unique (organizationId, schoolId, domain) fails with null schoolId — using findFirst + create/update instead"
  - "generatedTicketId has @unique constraint: One-to-one relation with MaintenanceTicket requires @unique on the FK field"
  - "Compliance page at /maintenance/compliance (not /app/[tenant]/maintenance/compliance): matches existing maintenance module structure — uses /app/maintenance/ pattern, not tenant subdomain routing"

patterns-established:
  - "Client-safe constants pattern: extract service constants to @/lib/types/*.ts when service imports server-only deps (mjml, fs, node:async_hooks)"
  - "Compliance domain status computation: isEnabled=false -> NOT_APPLICABLE, no record -> PENDING, passed -> CURRENT, daysUntilDue<0 -> OVERDUE, <=30 -> DUE_SOON"
  - "Compliance API follows exact same pattern as all other maintenance routes: getOrgIdFromRequest -> getUserContext -> assertCan -> runWithOrgContext"
  - "Cron endpoint mirrors /api/cron/maintenance-tasks: CRON_SECRET auth, per-org try/catch, non-fatal task isolation"

requirements-completed: [COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04]

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 6 Plan 1: Compliance Domain Configuration, Calendar, and Reminders Summary

**10 regulatory compliance domains with auto-populated school-year calendar, Framer Motion domain card grid, slide-over config wizard, and cron-based 30/7-day reminder emails to maintenance heads and admins**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T16:30:44Z
- **Completed:** 2026-03-06T16:42:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Two new Prisma models (ComplianceDomainConfig, ComplianceRecord) with 3 enums pushed to database
- complianceService.ts providing full CRUD, idempotent calendar population, and cross-org cron reminders
- 6 REST API endpoints for domains and records plus populate trigger and CRON_SECRET-secured reminder cron
- Compliance management page with staggered 10-domain card grid, toggle switches, setup wizard, and calendar view
- Compliance nav link (Shield icon) added to maintenance sidebar

## Task Commits

1. **Task 1: Schema, service, API routes, and cron reminder endpoint** - `96a1304` (feat)
2. **Task 2: Compliance management page with domain config UI and calendar view** - `00b707c` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added ComplianceDomainConfig, ComplianceRecord models, 3 enums, back-relations
- `src/lib/types/compliance.ts` - Client-safe constants (COMPLIANCE_DOMAIN_DEFAULTS, COMPLIANCE_DOMAINS)
- `src/lib/services/complianceService.ts` - Full compliance service with domain CRUD, calendar population, reminder dispatch
- `src/lib/permissions.ts` - COMPLIANCE_READ/MANAGE/EXPORT permissions + role assignments
- `src/lib/db/index.ts` - ComplianceDomainConfig + ComplianceRecord added to orgScopedModels; ComplianceRecord to softDeleteModels
- `src/lib/services/emailService.ts` - sendComplianceReminderEmail with urgency-colored HTML template
- `src/lib/services/notificationService.ts` - compliance_reminder added to NotificationType union
- `src/app/api/maintenance/compliance/domains/route.ts` - GET list + POST configure
- `src/app/api/maintenance/compliance/domains/[id]/route.ts` - GET detail + PATCH update
- `src/app/api/maintenance/compliance/domains/populate/route.ts` - POST populate calendar
- `src/app/api/maintenance/compliance/records/route.ts` - GET list with filters
- `src/app/api/maintenance/compliance/records/[id]/route.ts` - GET detail + PATCH update
- `src/app/api/cron/compliance-reminders/route.ts` - Cron job for 30/7-day reminders
- `src/components/maintenance/compliance/ComplianceDomainCard.tsx` - Domain card with toggle, status badge, icon
- `src/components/maintenance/compliance/ComplianceSetupWizard.tsx` - Slide-over config drawer
- `src/components/maintenance/compliance/ComplianceCalendar.tsx` - List + timeline calendar views
- `src/app/maintenance/compliance/page.tsx` - Compliance management page
- `src/components/Sidebar.tsx` - Compliance nav link added

## Decisions Made
- Client-safe constants extracted to `@/lib/types/compliance.ts` — prevents mjml/fs server deps from leaking into client bundles through the import chain
- `upsert` replaced with `findFirst + create/update` for ComplianceDomainConfig — Prisma fails on nullable composite unique keys when using upsert
- `generatedTicketId` requires `@unique` — Prisma one-to-one relations require unique constraint on FK field
- Compliance page placed at `/maintenance/compliance` to match existing maintenance module routing pattern (not tenant subdomain routing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma one-to-one relation missing @unique**
- **Found during:** Task 1 (Schema additions)
- **Issue:** `generatedTicketId` FK field lacked `@unique` constraint required for one-to-one relation — `db:push` failed with P1012 error
- **Fix:** Added `@unique` to `generatedTicketId` field on ComplianceRecord model
- **Files modified:** prisma/schema.prisma
- **Verification:** `npm run db:push` succeeded
- **Committed in:** 96a1304 (Task 1 commit)

**2. [Rule 1 - Bug] Replaced upsert with find-or-create for nullable composite unique**
- **Found during:** Task 1 (complianceService.ts)
- **Issue:** Prisma upsert on `@@unique([organizationId, schoolId, domain])` fails with null schoolId (type error: `null` not assignable to `string`)
- **Fix:** Changed `upsert` to `findFirst + update/create` pattern throughout complianceService
- **Files modified:** src/lib/services/complianceService.ts
- **Verification:** TypeScript `--noEmit` passes
- **Committed in:** 96a1304 (Task 1 commit)

**3. [Rule 3 - Blocking] Extracted constants to client-safe module to fix build**
- **Found during:** Task 2 (build verification)
- **Issue:** `complianceService.ts` imports `emailService.ts` which uses `mjml` (requires Node.js `fs`). Client components importing complianceService caused webpack error: "Module not found: Can't resolve 'fs'"
- **Fix:** Extracted `COMPLIANCE_DOMAIN_DEFAULTS` and `COMPLIANCE_DOMAINS` to `@/lib/types/compliance.ts`; updated client components to import from types file
- **Files modified:** src/lib/types/compliance.ts (created), src/components/maintenance/compliance/ComplianceDomainCard.tsx, ComplianceCalendar.tsx, complianceService.ts
- **Verification:** `npm run build` succeeds with compliance page as static route
- **Committed in:** 00b707c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 schema bug, 1 Prisma type bug, 1 blocking server-deps leak)
**Impact on plan:** All auto-fixes necessary for correctness and buildability. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Compliance foundation complete with domain config, calendar, and cron reminders
- Ready for Phase 6 Plan 2: Board Reporting (FCI calculations, PDF export, board-member dashboard)
- COMPLY-01 through COMPLY-04 requirements fulfilled

---
*Phase: 06-compliance-board-reporting*
*Completed: 2026-03-06*
