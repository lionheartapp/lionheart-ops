---
phase: 19-event-foundation
plan: "03"
subsystem: events-api
tags: [api-routes, event-project, event-series, crud, approval-workflow]
dependency_graph:
  requires: [19-02]
  provides: [event-project-api, event-series-api, from-submission-api]
  affects: [calendar-bridge, planning-submissions]
tech_stack:
  added: []
  patterns:
    - Next.js 15 async params pattern (RouteParams with Promise<{ id: string }>)
    - Event project approval flow (PENDING_APPROVAL → CONFIRMED with CalendarEvent bridge)
    - from-submission entry path (PlanningSubmission → EventProject with PLANNING_SUBMISSION source)
key_files:
  created:
    - src/app/api/events/projects/route.ts
    - src/app/api/events/projects/[id]/route.ts
    - src/app/api/events/projects/[id]/approve/route.ts
    - src/app/api/events/projects/[id]/activity/route.ts
    - src/app/api/events/from-submission/route.ts
    - src/app/api/events/projects/[id]/schedule/route.ts
    - src/app/api/events/projects/[id]/schedule/[blockId]/route.ts
    - src/app/api/events/projects/[id]/tasks/route.ts
    - src/app/api/events/projects/[id]/tasks/[taskId]/route.ts
    - src/app/api/events/series/route.ts
    - src/app/api/events/series/[id]/route.ts
  modified:
    - src/lib/types/event-project.ts
decisions:
  - "PATCH /api/events/projects/[id] requires EVENT_PROJECT_UPDATE_ALL (not UPDATE_OWN) — admin-level change consistent with plan intent"
  - "from-submission accepts APPROVED or PUBLISHED status — PUBLISHED covers already-published planning seasons"
  - "Series DELETE uses deactivation (isActive=false) not hard delete — existing spawned projects unaffected"
metrics:
  duration: 4m
  tasks_completed: 2
  files_created: 11
  files_modified: 1
  completed_date: "2026-03-15"
---

# Phase 19 Plan 03: EventProject API Routes Summary

11 API route files providing EventProject CRUD, schedule block management, task management, approval workflow, EventSeries CRUD, and the from-submission entry path.

## What Was Built

### EventProject Routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/events/projects` | GET (paginated list), POST (create) | EVENT_PROJECT_READ / EVENT_PROJECT_CREATE |
| `/api/events/projects/[id]` | GET (detail), PATCH (update), DELETE (soft-delete) | EVENT_PROJECT_READ / UPDATE_ALL / DELETE |
| `/api/events/projects/[id]/approve` | POST | EVENT_PROJECT_APPROVE |
| `/api/events/projects/[id]/activity` | GET | EVENT_PROJECT_READ |
| `/api/events/from-submission` | POST | PLANNING_MANAGE |

### Schedule Block Routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/events/projects/[id]/schedule` | GET (ordered by startsAt+sortOrder), POST | EVENT_PROJECT_READ / UPDATE_ALL |
| `/api/events/projects/[id]/schedule/[blockId]` | PATCH, DELETE (hard-delete) | EVENT_PROJECT_UPDATE_ALL |

### Task Routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/events/projects/[id]/tasks` | GET (status/assigneeId filters), POST | EVENT_PROJECT_READ / UPDATE_ALL |
| `/api/events/projects/[id]/tasks/[taskId]` | PATCH, DELETE (hard-delete) | EVENT_PROJECT_UPDATE_ALL |

### EventSeries Routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/events/series` | GET (isActive/campusId filters), POST | EVENT_SERIES_MANAGE |
| `/api/events/series/[id]` | GET (with projects), PATCH, DELETE (deactivate) | EVENT_SERIES_MANAGE |

## Pattern Applied in Every Route

All 11 routes follow the canonical project pattern:
1. `getOrgIdFromRequest(req)` — reads x-org-id header
2. `getUserContext(req)` — verifies JWT, gets userId
3. `assertCan(ctx.userId, PERMISSIONS.XXX)` — enforces permission
4. `runWithOrgContext(orgId, async () => { ... })` — wraps all DB work
5. `ok(data)` / `fail('CODE', 'message')` response envelope
6. `logger.child()` + `Sentry.captureException` for errors
7. Explicit ZodError → 400, permission → 403, not-found → 404, default → 500

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.record() incompatibility with Zod v4**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `z.record(z.unknown())` requires two type arguments in Zod v4 — key type and value type. The single-arg form is only valid in Zod v3.
- **Fix:** Changed all 6 occurrences to `z.record(z.string(), z.unknown())` in `src/lib/types/event-project.ts`
- **Files modified:** `src/lib/types/event-project.ts`
- **Commit:** e0c1384

### Out-of-scope Pre-existing Issue (logged to deferred)

`__tests__/lib/assistant-prompt.test.ts:158` — test mock missing `importance` field on `AssembledContext.relevantFacts`. Pre-existing error unrelated to event routes. Not introduced by this plan.

## Self-Check

Checking created files and commits...

## Self-Check: PASSED

All 11 route files found on disk. Both commits (e0c1384, 9aca971) confirmed in git log. SUMMARY.md exists.
