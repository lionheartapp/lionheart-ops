---
phase: 19-event-foundation
plan: "04"
subsystem: sidebar-navigation, tanstack-query-hooks
tags: [sidebar, events-nav, tanstack-query, hooks, ux]
dependency_graph:
  requires: [19-03]
  provides: [events-sidebar-nav, event-hooks]
  affects: [calendar-view, planning-view, events-pages]
tech_stack:
  added: []
  patterns:
    - Events-as-top-level-nav (secondary panel pattern matching athleticsNavContent)
    - TanStack Query with fetchApi from @/lib/api-client (cookie-based auth)
    - Sidebar query keys: ['event-projects', filters], ['event-project', id], ['event-schedule', id], ['event-tasks', id, filters], ['event-activity', id]
    - Mutation invalidation cascade: schedule/task mutations also invalidate activity log
key_files:
  created:
    - src/lib/hooks/useEventProject.ts
    - src/lib/hooks/useEventSchedule.ts
    - src/lib/hooks/useEventTasks.ts
  modified:
    - src/components/Sidebar.tsx
decisions:
  - "Events sidebar panel auto-opens on /events, /calendar, and /planning — not just /events. This ensures users already on calendar/planning see Events as home."
  - "calendarOpen is retained in parallel with eventsOpen for backward compat — calendarNavContent still powers the checkbox sidebar that calendar page uses."
  - "Planning CTA card moved from calendarNavContent to eventsNavContent — Events is now the top-level framing for calendar and planning."
  - "Active EventProjects list in sidebar uses TanStack Query with enabled:eventsOpen — no fetch unless panel is open."
  - "Dashboard link at /events/dashboard added as first item in Events panel — Plan 06 AI dashboard can wire to it without touching Sidebar.tsx."
metrics:
  duration: 4m
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  completed_date: "2026-03-15"
---

# Phase 19 Plan 04: Sidebar Refactor + TanStack Query Hooks Summary

Events navigation as primary sidebar item (CalendarClock icon, secondary panel with Dashboard/Calendar/Planning), plus 3 hook files providing full CRUD for event projects, schedule blocks, and tasks.

## What Was Built

### Sidebar Refactor (src/components/Sidebar.tsx)

- `eventsOpen` state added alongside existing `athleticsOpen`/`calendarOpen`/`settingsOpen`
- `handleEventsClick` handler opens Events panel and closes all other panels; toggles back to dashboard
- Events appears as second nav item (after Dashboard) with CalendarClock icon
- Calendar removed from top-level navItems — now nested inside Events panel
- `secondaryOpen = settingsOpen || calendarOpen || athleticsOpen || eventsOpen`
- Auto-open logic: `/events`, `/calendar`, `/planning` all trigger `eventsOpen = true`
- `eventsNavContent` includes:
  - Header with CalendarClock icon
  - Dashboard link (`/events/dashboard`) — first, required for Plan 06
  - Calendar link (`/calendar`)
  - Planning link (`/planning`)
  - Active Events section: fetches first 5 projects via TanStack Query when panel is open
  - Planning CTA card (moved from calendarNavContent)
- Secondary panel render updated: eventsOpen takes priority over athleticsOpen/calendarOpen/settingsNavContent
- Both desktop aside and mobile nav updated with same render logic
- Active state checks on navItems updated to include `!eventsOpen`

### Hook Files

#### useEventProject.ts
| Export | Type | Endpoint |
|--------|------|----------|
| `useEventProjects(filters?)` | query | `GET /api/events/projects` |
| `useEventProject(id)` | query | `GET /api/events/projects/${id}` |
| `useCreateEventProject()` | mutation | `POST /api/events/projects` |
| `useUpdateEventProject(id)` | mutation | `PATCH /api/events/projects/${id}` |
| `useApproveEventProject(id)` | mutation | `POST /api/events/projects/${id}/approve` |
| `useEventActivity(id)` | query | `GET /api/events/projects/${id}/activity` |

#### useEventSchedule.ts
| Export | Type | Endpoint |
|--------|------|----------|
| `useScheduleBlocks(eventProjectId)` | query | `GET /api/events/projects/${id}/schedule` |
| `useCreateScheduleBlock(eventProjectId)` | mutation | `POST /api/events/projects/${id}/schedule` |
| `useUpdateScheduleBlock(eventProjectId)` | mutation | `PATCH /api/events/projects/${id}/schedule/${blockId}` |
| `useDeleteScheduleBlock(eventProjectId)` | mutation | `DELETE /api/events/projects/${id}/schedule/${blockId}` |

#### useEventTasks.ts
| Export | Type | Endpoint |
|--------|------|----------|
| `useEventTasks(eventProjectId, filters?)` | query | `GET /api/events/projects/${id}/tasks` |
| `useCreateEventTask(eventProjectId)` | mutation | `POST /api/events/projects/${id}/tasks` |
| `useUpdateEventTask(eventProjectId)` | mutation | `PATCH /api/events/projects/${id}/tasks/${taskId}` |
| `useDeleteEventTask(eventProjectId)` | mutation | `DELETE /api/events/projects/${id}/tasks/${taskId}` |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/components/Sidebar.tsx` — modified, `eventsOpen` and `events/dashboard` present (20 references verified)
- [x] `src/lib/hooks/useEventProject.ts` — created, all 6 exports verified as functions
- [x] `src/lib/hooks/useEventSchedule.ts` — created, all 4 exports verified as functions
- [x] `src/lib/hooks/useEventTasks.ts` — created, all 4 exports verified as functions
- [x] TypeScript: only pre-existing test error, no new errors introduced
- [x] Commits: 1cfbce9 (sidebar), 717190b (hooks)
