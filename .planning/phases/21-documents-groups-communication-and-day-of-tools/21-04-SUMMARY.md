---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "04"
subsystem: groups-activities-dietary
tags: [groups, activities, auto-assign, dietary, medical, ferpa, api, phase-21]
dependency_graph:
  requires:
    - 21-01 (EventGroup, EventGroupAssignment, EventActivityOption, EventActivitySignup models + EVENTS_GROUPS_MANAGE, EVENTS_MEDICAL_READ permissions)
  provides:
    - eventGroupService.ts (group CRUD, assignment, auto-assign, activities, signups, dietary/medical aggregation)
    - GET/POST/PUT/DELETE /api/events/projects/[id]/groups
    - GET/POST/DELETE /api/events/projects/[id]/groups/[groupId]/assignments
    - POST /api/events/projects/[id]/groups/auto-assign
    - GET/POST/PUT/DELETE /api/events/projects/[id]/activities
    - GET/POST/DELETE /api/events/projects/[id]/activities/signups
    - GET /api/events/projects/[id]/dietary-medical
  affects:
    - Plans 21-07, 21-08 (UI for groups and activities)
tech_stack:
  added: []
  patterns:
    - prisma-as-any cast for Phase 21 org-scoped models (consistent with codebase pattern in eventProjectService)
    - rawPrisma for RegistrationSensitiveData (no organizationId column — FERPA isolation)
    - Capacity check before create pattern (check count, throw named error, catch in route for 409)
    - Round-robin auto-assign algorithm with in-memory Map for per-group count tracking (immutable pattern)
    - Independent group type membership (BUS+CABIN independent — participant can be in both)
key_files:
  created:
    - src/lib/services/eventGroupService.ts
    - src/app/api/events/projects/[id]/groups/route.ts
    - src/app/api/events/projects/[id]/groups/[groupId]/assignments/route.ts
    - src/app/api/events/projects/[id]/groups/auto-assign/route.ts
    - src/app/api/events/projects/[id]/activities/route.ts
    - src/app/api/events/projects/[id]/activities/signups/route.ts
    - src/app/api/events/projects/[id]/dietary-medical/route.ts
  modified: []
decisions:
  - prisma-as-any cast used for Phase 21 org-scoped models (EventGroup, EventGroupAssignment, EventActivityOption, EventActivitySignup) — Prisma's dynamic extension client doesn't expose TS types for newer models; rawPrisma used for RegistrationSensitiveData (FERPA isolation)
  - Auto-assign uses round-robin with capacity-aware skipping — groups sorted by available space (most space first), then participants round-robined across groups with space remaining
  - getUnassignedParticipants uses rawPrisma for EventRegistration (consistent with registration module pattern) and filters by group type independently — BUS/CABIN/SMALL_GROUP are separate group spaces
  - dietary-medical route uses EVENTS_MEDICAL_READ (not EVENTS_GROUPS_MANAGE) — FERPA gate isolates medical aggregation from routine group management access
metrics:
  duration: "~7 minutes"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 7
---

# Phase 21 Plan 04: Groups, Activities, and Dietary/Medical Summary

**One-liner:** Group CRUD, participant assignment, round-robin auto-assign, elective activity signups with capacity enforcement, and FERPA-gated dietary/medical aggregation across 7 service+route files.

## What Was Built

### Task 1: eventGroupService.ts

Full service layer with 5 functional areas:

**Group CRUD:**
- `createGroup` — creates EventGroup with type, name, capacity, leader, description, sortOrder
- `updateGroup` — partial update of any group fields
- `deleteGroup` — hard-delete (cascade to assignments)
- `listGroups` — returns groups with leader name+avatar, assignment count, sorted by sortOrder; optional type filter

**Assignments:**
- `assignToGroup` — capacity check first, then creates EventGroupAssignment; throws "Group is at capacity" on overflow
- `removeFromGroup` — deletes by compound unique key (registrationId_groupId)
- `getGroupAssignments` — returns assignments with full participant info (name, email, grade, photoUrl)
- `getUnassignedParticipants` — returns REGISTERED participants not in any group of the given type; BUS/CABIN/SMALL_GROUP are independent group spaces

**Auto-Assign:**
- `autoAssign` — round-robin algorithm: gets groups with space sorted by available capacity (most space first), sorts participants by grade if `balanceBy: 'grade'` specified, round-robins participants across groups tracking counts in-memory Map (immutable pattern), creates assignments sequentially, returns `{ assignmentsCreated: number }`

**Activities:**
- `createActivity`, `updateActivity`, `deleteActivity` — standard CRUD for EventActivityOption
- `listActivities` — returns activities with signupCount + isFull flag

**Activity Signups:**
- `signupForActivity` — capacity check first, throws "Activity is full" on overflow
- `cancelActivitySignup` — deletes by compound unique key (registrationId_activityId)
- `getActivitySignups` — returns signups with participant info

**Dietary/Medical Report:**
- `getDietaryMedicalReport` — aggregates across all REGISTERED participants using rawPrisma (RegistrationSensitiveData has no orgId column)
  - `dietarySummary`: parses comma-separated dietaryNeeds field, counts per need, sorts by frequency
  - `allergySummary`: parses comma-separated allergies, includes participant names (not notes) per allergy
  - `medicationCount`: count of participants with non-empty medications
  - `participantsWithMedicalNotes`: names only (individual lookup required for actual notes)

### Task 2: 6 API Route Files

All routes follow the standard pattern: `getOrgIdFromRequest` + `getUserContext` + `assertCan` + `runWithOrgContext`.

**groups/route.ts** — GET/POST/PUT/DELETE:
- GET supports optional `?type=BUS` filter
- POST returns 201 on create
- PUT/DELETE accept body with `groupId` field

**groups/[groupId]/assignments/route.ts** — GET/POST/DELETE:
- GET returns `{ assignments, unassigned, capacity }` — all data needed to render assignment UI
- POST uses `ctx.userId` as `assignedById`, returns 409 on capacity exceeded
- DELETE accepts `{ registrationId }` in body

**groups/auto-assign/route.ts** — POST:
- Accepts `{ groupType, balanceBy? }` (balanceBy: 'grade' | 'gender')
- Returns 409 on partial capacity hit, 422 if no groups exist

**activities/route.ts** — GET/POST/PUT/DELETE:
- POST/PUT handle `scheduledAt` as ISO datetime string → Date conversion
- Returns 201 on create

**activities/signups/route.ts** — GET/POST/DELETE:
- GET requires `?activityId=` query param (400 without it)
- POST returns 409 "Activity is full" on capacity exceeded

**dietary-medical/route.ts** — GET:
- Uses `EVENTS_MEDICAL_READ` (admin-only FERPA gate), NOT `EVENTS_GROUPS_MANAGE`

## Commits

- `b161154` — feat(21-04): create eventGroupService with group CRUD, assignment, auto-assign, activities, and dietary/medical report
- `81a9da4` — feat(21-04): create group, activity, and dietary/medical API routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client generation required for Phase 21 models**
- **Found during:** Task 1 — TypeScript reported `eventGroup` does not exist on prisma client
- **Issue:** Phase 21 schema was added in Plan 21-01 but `prisma generate` hadn't been run since; the Prisma-generated client didn't include EventGroup, EventGroupAssignment, EventActivityOption, EventActivitySignup types
- **Fix:** Ran `npx prisma generate` to regenerate the client with all Phase 21 models
- **Files modified:** node_modules/@prisma/client (generated)
- **Commit:** Inline fix during Task 1

**2. [Rule 1 - Bug] `avatarUrl` field does not exist on User model**
- **Found during:** Task 1 — TypeScript reported `avatarUrl` does not exist in UserSelect
- **Issue:** User model uses `avatar` (not `avatarUrl`) per schema.prisma line 185
- **Fix:** Changed `avatarUrl` to `avatar` in listGroups leader select clause
- **Files modified:** src/lib/services/eventGroupService.ts
- **Commit:** Inline fix during Task 1

**3. [Rule 1 - Bug] org-scoped prisma client type incompatibility with Phase 21 models**
- **Found during:** Task 1 — TypeScript errors on create calls (organizationId injection via extension)
- **Issue:** The org-scoped `prisma` extension client's TypeScript types don't fully propagate for dynamically-extended models; create operations require explicit `organizationId` in the TS type signature but the extension handles injection at runtime
- **Fix:** Used `const db = prisma as any` pattern (identical to pattern in eventProjectService.ts and tasks/route.ts throughout codebase)
- **Files modified:** src/lib/services/eventGroupService.ts
- **Commit:** Inline fix during Task 1

## Self-Check: PASSED

All artifacts verified:
- [x] src/lib/services/eventGroupService.ts — FOUND (680 lines)
- [x] src/app/api/events/projects/[id]/groups/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/groups/[groupId]/assignments/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/groups/auto-assign/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/activities/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/activities/signups/route.ts — FOUND
- [x] src/app/api/events/projects/[id]/dietary-medical/route.ts — FOUND
- [x] Commit b161154 — FOUND
- [x] Commit 81a9da4 — FOUND
- [x] `npx tsc --noEmit` — 0 errors in new files
