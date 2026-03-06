---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02-core-tickets/02-03-PLAN.md
last_updated: "2026-03-06T03:05:00.000Z"
last_activity: 2026-03-05 — Roadmap created; all 101 v1 requirements mapped across 7 phases
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Teachers can photograph a broken fixture and submit a maintenance request in under 60 seconds, while the maintenance team sees everything on a Kanban board with AI-assisted diagnostics — replacing SchoolDude for day-to-day ticket management.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-03-05 — Roadmap created; all 101 v1 requirements mapped across 7 phases

Progress: [████████░░] 83%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P01 | 3 | 2 tasks | 3 files |
| Phase 01-foundation P02 | 6 | 2 tasks | 9 files |
| Phase 02-core-tickets P01 | 11min | 2 tasks | 16 files |
| Phase 02-core-tickets P02 | 6min | 2 tasks | 8 files |
| Phase 02-core-tickets P03 | 6min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Separate MaintenanceTicket model (not extending existing Ticket) — maintenance lifecycle is fundamentally different
- [Roadmap]: Claude API (Anthropic) for AI diagnostics, not Gemini — pinned to claude-sonnet-4-5 via direct SDK
- [Roadmap]: Supabase Storage for all file uploads; signed URL pattern to bypass Next.js 1MB body limit
- [Roadmap]: 8-status Kanban from day one; SCHEDULED and QA statuses solve real Linfield pain points
- [Roadmap]: Phase 3 must be preceded by Phase 2 — Kanban and AI layer on top of the ticket engine
- [Phase 01-foundation]: MaintenanceTicket is separate from Ticket model — 8-status Kanban lifecycle, AI diagnostics, and labor tracking make it fundamentally different
- [Phase 01-foundation]: Organization.timezone defaults to America/Los_Angeles (Linfield is California-based) for Phase 6 compliance date arithmetic
- [Phase 01-foundation]: MaintenanceCounter and MaintenanceAssetCounter use rawPrisma — org-unique singletons for atomic increment, excluded from orgScopedModels
- [Phase 01-foundation]: Maintenance nav uses simple links (no secondary sidebar panel) — permissions gate which links appear
- [Phase 01-foundation]: Extended /api/auth/permissions endpoint with 3 maintenance permission checks rather than a separate endpoint
- [Phase 01-foundation]: Emerald color theme for maintenance (#059669) to distinguish from amber (athletics) and primary-blue (core nav)
- [Phase 02-core-tickets]: Room fields are roomNumber/displayName not name/code — corrected in all route includes and service layer
- [Phase 02-core-tickets]: assignTicket has no specialty check (ROUTE-03) — head can assign any ticket to any tech regardless of specialty
- [Phase 02-core-tickets]: Cron uses rawPrisma (no org context) to iterate all orgs — cross-platform maintenance tasks
- [Phase 02-core-tickets]: Room-level entries in useCampusLocations use roomId field with hierarchy array for Building > Area > Room display
- [Phase 02-core-tickets]: Wizard renders inline as full-area panel (not modal) for mobile usability — avoids scroll lock and z-index issues
- [Phase 02-core-tickets]: AI suggested category auto-applies on first photo upload; user can override freely — reduces friction
- [Phase 02-core-tickets]: Two-query split for Work Orders: main tickets (excludeStatus=SCHEDULED) + dedicated scheduled query keeps scheduled section independent of main filter state
- [Phase 02-core-tickets]: Optimistic claim mutation: onMutate snapshots cache + patches with placeholder, onError rolls back, onSettled invalidates — user sees instant assignment feedback

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Verify whether `Organization` model already has a `timezone` field; if not, add it in Phase 1 settings (required for Phase 6 compliance date arithmetic — one-line schema addition, zero risk)
- [Phase 4]: `avoidSchoolYear` flag on PM schedules requires a `SchoolCalendar` model with break date ranges; decide before Phase 4 planning whether to (a) add SchoolCalendar as Phase 4 prerequisite or (b) ship flag as display-only until calendar model exists
- [Phase 6]: FCI calculation scope decision needed: use only closed ticket costs, or include `estimatedRepairCostUSD` on open tickets for deferred maintenance cost? Latter is more useful but requires the field to be added in Phase 2.
- [Phase 7]: Offline PWA sync architecture (serwist/next + dexie + conflict resolution UX) is medium-confidence; recommend a focused research spike before Phase 7 planning begins

## Session Continuity

Last session: 2026-03-06T02:58:35.350Z
Stopped at: Completed 02-02-PLAN.md (checkpoint approved by user)
Resume file: None
