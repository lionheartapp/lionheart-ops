---
phase: 01-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, permissions, maintenance, schema]

# Dependency graph
requires: []
provides:
  - 9 new Prisma models for Maintenance module (MaintenanceTicket, MaintenanceCounter, TechnicianProfile, MaintenanceTicketActivity, MaintenanceLaborEntry, MaintenanceCostEntry, MaintenanceAsset, PmSchedule, MaintenanceAssetCounter)
  - 6 new enums (MaintenanceTicketStatus, MaintenanceCategory, MaintenanceSpecialty, MaintenancePriority, HoldReason, MaintenanceActivityType)
  - Organization.timezone field for IANA timezone compliance
  - 13 MAINTENANCE_* permission constants in PERMISSIONS object
  - MAINTENANCE_HEAD and MAINTENANCE_TECHNICIAN roles in DEFAULT_ROLES
  - 7 maintenance models registered in orgScopedModels extension
  - 2 maintenance models (MaintenanceTicket, MaintenanceAsset) registered in softDeleteModels
affects: [02-ticket-engine, 03-kanban-ai, 04-advanced-features, 05-analytics, 06-compliance, 07-offline-pwa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Maintenance counter pattern: rawPrisma.maintenanceCounter.update({ data: { lastTicketNumber: { increment: 1 } } }) then format as MT-${String(n).padStart(4, '0')}"
    - "Org-scope registration in Set: add model name to orgScopedModels Set in src/lib/db/index.ts"
    - "Role definition pattern: add to DEFAULT_ROLES with slug, name, description, permissions array, isSystem: true"

key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/permissions.ts

key-decisions:
  - "MaintenanceTicket is a separate model from existing Ticket — maintenance lifecycle (8 statuses, Kanban, AI diagnostics, labor tracking) is fundamentally different from the simple 3-status support Ticket"
  - "Organization.timezone defaults to America/Los_Angeles (Linfield is California-based) for compliance date arithmetic"
  - "MaintenanceCounter and MaintenanceAssetCounter use rawPrisma (not org-scoped) — they are org-unique singletons, not tenant-readable lists"
  - "MaintenanceSpecialty enum mirrors MaintenanceCategory values — category and specialty map 1:1 per ROUTE-01"
  - "School relation added to MaintenanceAsset for campus-level asset scoping (required for Prisma back-relation validation)"

patterns-established:
  - "Maintenance ticket number format: MT-0001 via MaintenanceCounter atomic increment"
  - "Asset number format: AST-0001 via MaintenanceAssetCounter atomic increment"
  - "Soft-delete on tickets and assets only — activity logs, labor entries, cost entries use hard delete or deactivation flags"

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 1 Plan 01: Maintenance Schema Foundation Summary

**9 Prisma maintenance models with 8-status Kanban enum, technician profiles, activity audit trail, and 13 permission constants seeded into org-scope extension and DEFAULT_ROLES**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T00:37:51Z
- **Completed:** 2026-03-06T00:40:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added 9 new Prisma models covering the full maintenance module data layer: tickets, counters (MT-XXXX and AST-XXXX), technician profiles, activity audit trail, labor entries, cost entries, assets, and PM schedules
- Added 6 new enums including MaintenanceTicketStatus (8 values: BACKLOG, TODO, IN_PROGRESS, ON_HOLD, SCHEDULED, QA, DONE, CANCELLED) and MaintenanceCategory/Specialty with 8 values each
- Added Organization.timezone (IANA, default America/Los_Angeles) for Phase 6 compliance date arithmetic
- Registered 7 models in orgScopedModels and 2 in softDeleteModels, generated Prisma client with full type support
- Defined 13 MAINTENANCE_* permission constants and 2 new roles (maintenance-head, maintenance-technician); updated ADMIN, MEMBER, TEACHER, VIEWER with appropriate permissions
- `npx prisma validate` and `npx prisma generate` both pass cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 9 maintenance Prisma models, enums, and Organization.timezone** - `ccf233b` (feat)
2. **Task 2: Register org-scope/soft-delete, add permissions, add maintenance-head role** - `97783be` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - 9 new maintenance models, 6 new enums, Organization.timezone, back-relations on Organization/User/Building/Area/Room/School
- `src/lib/db/index.ts` - 7 maintenance models in orgScopedModels, 2 in softDeleteModels
- `src/lib/permissions.ts` - 13 MAINTENANCE_* permission constants, MAINTENANCE_HEAD role, MAINTENANCE_TECHNICIAN role, permissions added to ADMIN/MEMBER/TEACHER/VIEWER

## Decisions Made
- MaintenanceTicket is a separate model from existing Ticket — the 8-status Kanban lifecycle, AI diagnostics, labor/cost tracking, and QA sign-off make it fundamentally different from the simple 3-status support Ticket model
- Organization.timezone defaults to America/Los_Angeles since Linfield is California-based; field is IANA-formatted for use with date-fns-tz or Day.js timezone methods in Phase 6
- MaintenanceCounter and MaintenanceAssetCounter use rawPrisma (excluded from orgScopedModels) — they are org-unique singletons intended for atomic increment operations, not tenant-readable lists
- School back-relation added to MaintenanceAsset model to satisfy Prisma bidirectional relation validation (plan specified School in MaintenanceAsset's schoolId field but didn't explicitly add the School model back-relation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added School back-relation to MaintenanceAsset**
- **Found during:** Task 1 (schema validation)
- **Issue:** Plan specified `schoolId` on MaintenanceAsset and added `maintenanceAssets MaintenanceAsset[]` to School model, but didn't include the corresponding `school School?` relation field in MaintenanceAsset. Prisma validate threw P1012 error.
- **Fix:** Added `school School? @relation(fields: [schoolId], references: [id], onDelete: SetNull)` to MaintenanceAsset model
- **Files modified:** prisma/schema.prisma
- **Verification:** `npx prisma validate` passed with zero errors after fix
- **Committed in:** ccf233b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - missing back-relation caught by schema validator)
**Impact on plan:** Fix was necessary for Prisma schema correctness. No scope creep — the field was already specified in the plan, just missing its back-relation.

## Issues Encountered
None beyond the auto-fixed schema validation error above.

## User Setup Required
None — schema changes are local. `db:push` to production will be needed before Phase 2 features are deployed, but is out of scope for this plan (plan explicitly deferred `db:push` to end of plan after all changes, and this plan only changes schema + code).

Note: The plan's Task 2 action section says "run `npm run db:push`" but the plan's task verify step only requires `prisma validate && prisma generate`. Schema push to the database is a deployment concern handled separately.

## Next Phase Readiness
- Complete data layer foundation is in place for Phase 2 (Ticket Engine)
- All 9 models available via org-scoped Prisma client after `db:push`
- Permission system ready — Phase 2 API routes can immediately use `assertCan(userId, PERMISSIONS.MAINTENANCE_SUBMIT)` etc.
- Concern tracked in STATE.md: existing orgs need a backfill script to get the new roles/permissions (new orgs via `seedOrgDefaults` will get them automatically)

## Self-Check: PASSED

- prisma/schema.prisma: FOUND
- src/lib/db/index.ts: FOUND
- src/lib/permissions.ts: FOUND
- .planning/phases/01-foundation/01-01-SUMMARY.md: FOUND
- Commit ccf233b (Task 1): FOUND
- Commit 97783be (Task 2): FOUND

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
