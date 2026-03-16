---
phase: 19-event-foundation
plan: "01"
subsystem: data-foundation
tags: [prisma, schema, permissions, org-scoping, soft-delete, event-project]
dependency_graph:
  requires: []
  provides:
    - EventProject model (org-scoped, soft-delete)
    - EventSeries model (org-scoped)
    - EventScheduleBlock model (org-scoped)
    - EventTask model (org-scoped)
    - EventActivityLog model (org-scoped, append-only)
    - 6 new enums (EventProjectStatus, EventProjectSource, EventScheduleBlockType, EventTaskStatus, EventTaskPriority, EventActivityType)
    - 7 new permission constants (EVENT_PROJECT_* and EVENT_SERIES_MANAGE)
  affects:
    - prisma/schema.prisma (5 new models, 6 new enums, relations on 7 existing models)
    - src/lib/db/index.ts (orgScopedModels + softDeleteModels updated)
    - src/lib/permissions.ts (new constants + role assignments)
    - Prisma generated client
tech_stack:
  added: []
  patterns:
    - Org-scoped Prisma extension pattern (models added to orgScopedModels Set)
    - Soft-delete pattern via deletedAt (EventProject added to softDeleteModels)
    - Append-only activity log pattern (EventActivityLog has no updatedAt)
    - Named relations for disambiguation (EventProjectCreator, EventProjectApprover, etc.)
key_files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/permissions.ts
decisions:
  - "EventProject uses separate seriesId FK and sourceId String? to avoid confusion between the series backreference and the planning submission source reference"
  - "EventActivityLog has no updatedAt field — rows are immutable per append-only pattern"
  - "EventTask.createdById uses Restrict delete (not SetNull) to preserve data integrity for task attribution"
  - "EventSeries.createdById uses Restrict delete to preserve series creator attribution"
  - "MEMBER role gets CREATE, READ, UPDATE_OWN — not DELETE, APPROVE, or SERIES_MANAGE (those require admin)"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-14"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 19 Plan 01: Schema Foundation Summary

**One-liner:** EventProject hub model with 5 org-scoped child models, 6 enums, 7 permission constants, and db:push applied to local database.

## What Was Built

This plan established the complete data foundation for the Phase 19 event system. No application code was written — only schema, extension registration, and permission definitions that all subsequent plans depend on.

### Prisma Schema Changes (prisma/schema.prisma)

**6 new enums added:**
- `EventProjectStatus` — DRAFT, PENDING_APPROVAL, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
- `EventProjectSource` — PLANNING_SUBMISSION, SERIES, DIRECT_REQUEST
- `EventScheduleBlockType` — SESSION, ACTIVITY, MEAL, FREE_TIME, TRAVEL, SETUP
- `EventTaskStatus` — TODO, IN_PROGRESS, BLOCKED, DONE
- `EventTaskPriority` — LOW, NORMAL, HIGH, CRITICAL
- `EventActivityType` — CREATED, STATUS_CHANGE, TASK_CREATED, TASK_UPDATED, TASK_COMPLETED, SCHEDULE_BLOCK_ADDED, SCHEDULE_BLOCK_UPDATED, SCHEDULE_BLOCK_REMOVED, FIELD_UPDATED, APPROVAL_REQUESTED, APPROVAL_GRANTED, APPROVAL_REJECTED

**5 new models added:**
- `EventProject` — Hub model. Org-scoped, soft-delete. FK relations to Organization, Campus, School, Building, Area, Room, EventSeries, User (creator + approver). Children: EventScheduleBlock[], EventTask[], EventActivityLog[].
- `EventSeries` — Recurring event template. Org-scoped. Has rrule, defaultStartTime, defaultDuration, defaultLocationText, resourceNeeds. Creator relation named `EventSeriesCreator`.
- `EventScheduleBlock` — Multi-day schedule time block. Org-scoped. FK to EventProject (Cascade delete). Lead relation named `ScheduleBlockLead`.
- `EventTask` — Task within an event. Org-scoped. FK to EventProject (Cascade delete). Assignee named `EventTaskAssignee`, creator named `EventTaskCreator`.
- `EventActivityLog` — Immutable audit trail. Org-scoped. NO updatedAt field. FK to EventProject (Cascade delete). Actor named `EventActivityActor`.

**Relations added to 7 existing models:**
- `Organization` — eventProjects, eventSeries, eventScheduleBlocks, eventTasks, eventActivityLogs
- `User` — eventProjectsCreated, eventProjectsApproved, eventSeriesCreated, scheduleBlocksLed, eventTasksAssigned, eventTasksCreated, eventActivitiesPerformed
- `Building` — eventProjects
- `Area` — eventProjects
- `Room` — eventProjects
- `Campus` — eventProjects
- `School` — eventProjects

### Org-Scope Extension (src/lib/db/index.ts)

Added to `orgScopedModels`: EventProject, EventSeries, EventScheduleBlock, EventTask, EventActivityLog

Added to `softDeleteModels`: EventProject

### Permissions (src/lib/permissions.ts)

**7 new constants added:**
```
EVENT_PROJECT_CREATE: 'events:project:create'
EVENT_PROJECT_READ: 'events:project:read'
EVENT_PROJECT_UPDATE_OWN: 'events:project:update:own'
EVENT_PROJECT_UPDATE_ALL: 'events:project:update:all'
EVENT_PROJECT_DELETE: 'events:project:delete'
EVENT_PROJECT_APPROVE: 'events:project:approve'
EVENT_SERIES_MANAGE: 'events:series:manage'
```

**Role updates:**
- ADMIN role — all 7 permissions granted
- MEMBER role — CREATE, READ, UPDATE_OWN granted (no delete/approve/series manage)

The `seedOrgDefaults` function in `organizationRegistrationService.ts` dynamically iterates `Object.values(DEFAULT_ROLES)` so no changes were needed there — new permissions are automatically picked up on org creation.

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | PASS |
| `npm run db:push` | PASS — schema applied to local DB |
| Model count in orgScopedModels (5 new entries) | 6 matches (5 unique names each appearing in the Set) |
| Permission string count (`events:project\|events:series`) | 7 matches |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4807460 | feat(19-01): add EventProject hub model and all child models to Prisma schema |
| 2 | 8e2c3ab | feat(19-01): register event models in org-scope extension and add permissions |

## Self-Check: PASSED

All files verified to exist. All commit hashes verified in git log:
- prisma/schema.prisma: FOUND
- src/lib/db/index.ts: FOUND
- src/lib/permissions.ts: FOUND
- Commit 4807460: FOUND
- Commit 8e2c3ab: FOUND
