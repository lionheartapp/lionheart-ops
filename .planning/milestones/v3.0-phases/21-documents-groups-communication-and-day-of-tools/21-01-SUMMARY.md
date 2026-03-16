---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "01"
subsystem: data-foundation
tags: [prisma, schema, permissions, typescript-types, phase-21]
dependency_graph:
  requires: []
  provides:
    - EventDocumentRequirement model
    - EventDocumentCompletion model
    - EventComplianceItem model
    - EventGroup model
    - EventGroupAssignment model
    - EventActivityOption model
    - EventActivitySignup model
    - EventAnnouncement model
    - EventCheckIn model
    - EventIncident model
    - EventIncidentParticipant model
    - EventSurvey model
    - EventSurveyResponse model
    - EventPresenceSession model
    - 6 new enums (EventGroupType, ComplianceItemStatus, EventIncidentSeverity, EventIncidentType, AnnouncementAudience, SurveyStatus)
    - 7 new permissions (events:documents:manage through events:surveys:manage)
    - Shared TypeScript types at src/lib/types/events-phase21.ts
  affects:
    - prisma/schema.prisma (all Phase 21 plans depend on these models)
    - src/lib/db/index.ts (org-scoping for all 13 new org-scoped models)
    - src/lib/permissions.ts (ADMIN + MEMBER role permission sets)
tech_stack:
  added: []
  patterns:
    - Cascaded FK pattern for EventProject children (all new models cascade-delete with EventProject)
    - Named relation pattern for disambiguation (ComplianceItemAssignee, GroupLeader, GroupAssigner, CheckInStaff, IncidentReporter, AnnouncementAuthor, PresenceUser)
    - Unique constraint pattern for junction tables (EventGroupAssignment, EventActivitySignup, EventCheckIn)
    - EventIncidentSeverity/EventIncidentType prefixed to avoid conflict with existing IncidentSeverity (Security module)
key_files:
  created:
    - src/lib/types/events-phase21.ts
  modified:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/permissions.ts
decisions:
  - EventIncidentSeverity/EventIncidentType prefixed with 'Event' to avoid enum collision with existing IncidentSeverity/IncidentType used by the Security Incidents module
  - EventIncidentParticipant excluded from orgScopedModels — pure junction table with no organizationId column (consistent with UserTeam pattern)
  - No models added to softDeleteModels — Phase 21 models are event-child records that cascade-delete with EventProject
  - MEMBER role receives 5 of 7 new permissions (COMPLIANCE_MANAGE and SURVEYS_MANAGE are admin-only)
metrics:
  duration: "~4 minutes"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 4
---

# Phase 21 Plan 01: Data Foundation Summary

**One-liner:** Schema foundation with 14 Prisma models, 6 enums, 7 permissions, and shared TypeScript types for document tracking, groups, announcements, check-in, incidents, surveys, and presence across Phase 21.

## What Was Built

### Task 1: Prisma Schema (prisma/schema.prisma)

Added 6 new enums and 14 new models for Phase 21 features:

**Enums:**
- `EventGroupType` — BUS, CABIN, SMALL_GROUP, ACTIVITY
- `ComplianceItemStatus` — NOT_STARTED, IN_PROGRESS, COMPLETE
- `EventIncidentSeverity` — MINOR, MODERATE, SERIOUS (prefixed to avoid Security module collision)
- `EventIncidentType` — MEDICAL, BEHAVIORAL, SAFETY, OTHER (prefixed for same reason)
- `AnnouncementAudience` — ALL, GROUP, INCOMPLETE_DOCS, PAID_ONLY
- `SurveyStatus` — DRAFT, ACTIVE, CLOSED

**Models:**
1. `EventDocumentRequirement` — Required document definition per event
2. `EventDocumentCompletion` — Per-participant document completion tracking
3. `EventComplianceItem` — Off-campus compliance checklist
4. `EventGroup` — Group definition (bus, cabin, small group, activity)
5. `EventGroupAssignment` — Participant-to-group mapping
6. `EventActivityOption` — Elective activity option
7. `EventActivitySignup` — Participant activity signup
8. `EventAnnouncement` — Targeted announcement with audience filter
9. `EventCheckIn` — QR code check-in record with offline sync support
10. `EventIncident` — Day-of incident log
11. `EventIncidentParticipant` — Junction: incident to involved participants
12. `EventSurvey` — Post-event feedback survey (reuses RegistrationForm builder)
13. `EventSurveyResponse` — Individual survey submission
14. `EventPresenceSession` — Real-time staff presence tracking

All models have correct cascade rules, unique constraints, and reverse relations on EventProject, EventRegistration, User, Organization, and RegistrationForm.

Schema passes `npx prisma validate`.

### Task 2: db/index.ts + permissions.ts + shared types

**src/lib/db/index.ts:**
- Added 13 models to orgScopedModels (all Phase 21 models with organizationId)
- EventIncidentParticipant correctly excluded (pure junction, no organizationId)
- No models added to softDeleteModels (cascade-delete pattern used instead)

**src/lib/permissions.ts:**
- Added 7 new permission constants under "Event Documents, Groups, Communication, Day-of Tools — Phase 21"
- ADMIN role: all 7 permissions
- MEMBER role: 5 permissions (documents, groups, checkin, announcements, incidents)
- COMPLIANCE_MANAGE and SURVEYS_MANAGE reserved for admin-only access

**src/lib/types/events-phase21.ts (new file):**
- TypeScript interfaces for all 6 Phase 21 feature areas
- Interfaces include enriched shapes (e.g., completion counts, leader names, participant lists)
- Ready for consumption by API route handlers and UI components in Plans 02-10

## Commits

- `62b2a77` — feat(21-01): add Phase 21 Prisma models and enums
- `a6629f9` — feat(21-01): register Phase 21 models, add permissions, create shared types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed IncidentSeverity and IncidentType to EventIncidentSeverity and EventIncidentType**
- **Found during:** Task 1 — `npx prisma validate` reported enum name collision
- **Issue:** The Security Incidents module (Phase ~15) already defined `IncidentSeverity` (LOW, MEDIUM, HIGH, CRITICAL) and `IncidentType` enums with different values
- **Fix:** Prefixed both new enums with `Event` to create `EventIncidentSeverity` and `EventIncidentType`; updated `EventIncident` model to use the prefixed names
- **Files modified:** prisma/schema.prisma
- **Commit:** 62b2a77

## Self-Check: PASSED

All artifacts verified:
- [x] prisma/schema.prisma — FOUND (14 new models, 6 new enums)
- [x] src/lib/db/index.ts — FOUND (13 new models in orgScopedModels)
- [x] src/lib/permissions.ts — FOUND (7 new permission constants, assigned to ADMIN + MEMBER)
- [x] src/lib/types/events-phase21.ts — FOUND (shared interfaces for all feature areas)
- [x] 21-01-SUMMARY.md — FOUND
- [x] Commit 62b2a77 — FOUND
- [x] Commit a6629f9 — FOUND
- [x] `npx prisma validate` — PASSED
- [x] `npx tsc --noEmit` — PASSED (pre-existing test error only, unrelated to our changes)
