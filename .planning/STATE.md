---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-03-06T16:29:27.504Z"
last_activity: "2026-03-06 — Completed 02-03: Work Orders table, filters, specialty highlighting, and live dashboard stats"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 21
  completed_plans: 15
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Teachers can photograph a broken fixture and submit a maintenance request in under 60 seconds, while the maintenance team sees everything on a Kanban board with AI-assisted diagnostics — replacing SchoolDude for day-to-day ticket management.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 2 of 7 (Core Tickets)
Plan: 3 of 4 in current phase
Status: In progress — ready for next plan (02-04)
Last activity: 2026-03-06 — Completed 02-03: Work Orders table, filters, specialty highlighting, and live dashboard stats

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
| Phase 02-core-tickets P04 | 25min | 2 tasks | 10 files |
| Phase 03-kanban-ai P02 | 18min | 2 tasks | 8 files |
| Phase 03-kanban-ai P01 | 25min | 2 tasks | 8 files |
| Phase 04-assets-qr-pm P01 | 8min | 2 tasks | 14 files |
| Phase 04-assets-qr-pm P05 | 30min | 2 tasks | 14 files |
| Phase 04-assets-qr-pm P03 | 16min | 2 tasks | 11 files |
| Phase 04-assets-qr-pm P02 | 45min | 2 tasks | 20 files |
| Phase 04-assets-qr-pm P04 | 5min | 2 tasks | 6 files |
| Phase 05-analytics-repair-intelligence P01 | 8min | 2 tasks | 12 files |
| Phase 05-analytics-repair-intelligence P02 | 9min | 2 tasks | 9 files |

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
- [Phase 02-core-tickets]: TicketStatusTracker uses primary linear path with ON_HOLD/SCHEDULED/CANCELLED as branch state badges, not sequential steps
- [Phase 02-core-tickets]: All gate UIs follow CONTEXT.md: inline expansion for hold, modal for QA transition, review panel for sign-off — consistent across phase
- [Phase 03-kanban-ai]: Anthropic claude-sonnet-4-5 model used (not Gemini) per project decision — pinned model for maintenance AI diagnostics
- [Phase 03-kanban-ai]: AI cache stored in existing MaintenanceTicket.aiAnalysis Json? field — no schema change needed for Phase 03
- [Phase 03-kanban-ai]: MAINTENANCE_CLAIM permission guards both AI routes — technicians and heads can use AI, submitter-only users cannot
- [Phase 03-kanban-ai]: Client-safe maintenance-transitions.ts: importing maintenanceTicketService pulls mjml/fs server deps into client bundle — created separate lightweight file
- [Phase 03-kanban-ai]: Fixed WorkOrdersFilters enum mismatches: QA_REVIEW->QA, CARPENTRY->STRUCTURAL, PAINTING->CUSTODIAL_BIOHAZARD, CLEANING->IT_AV to match Prisma schema
- [Phase 04-assets-qr-pm]: ASSETS_READ/CREATE/UPDATE/DELETE fine-grained permissions separate from legacy MAINTENANCE_MANAGE_ASSETS; QR endpoint returns immutable SVG; pmScheduleId nullable with @@unique constraint for PM-10 idempotency
- [Phase 04-assets-qr-pm]: rawPrisma used in laborCostService (labor/cost models not in orgScopedModels); routes provide org scoping via runWithOrgContext
- [Phase 04-assets-qr-pm]: Labor timer state in localStorage keyed by ticketId; resumes on navigation back across page refreshes
- [Phase 04-assets-qr-pm]: getCostSummary computed server-side to avoid JS float precision errors for Phase 6 FCI calculations
- [Phase 04-assets-qr-pm]: Client-safe type extraction into src/lib/types/pm-schedule.ts prevents node:async_hooks from leaking into client bundles via @/lib/db import chain
- [Phase 04-assets-qr-pm]: Zod schema split: base schema without .refine() used for .partial() in UpdatePmScheduleSchema; create schema adds .refine() on top for CUSTOM validation
- [Phase 04-assets-qr-pm]: html5-qrcode for browser QR scanning; jsPDF for client-side label PDFs; assetId nullable FK on MaintenanceTicket; StepAsset optional in wizard (Skip button)
- [Phase 04-assets-qr-pm]: Lazy import for pmScheduleService in maintenanceTicketService DONE handler avoids circular dependency; generatePmTickets uses rawPrisma (no org context in cron); submittedById fallback to any active org user when no default tech set
- [Phase 04-assets-qr-pm]: PM cron idempotency via P2002 unique constraint catch; QA gate dual-enforced client+server; nextDueDate cycles from completion date not scheduled date
- [Phase 05-analytics-repair-intelligence]: rawPrisma in analytics service for cross-entity aggregations; campus filter resolves via school.campusId join; PM Compliance inline stat cards rather than chart
- [Phase 05-analytics-repair-intelligence]: TenantModule uses moduleId not moduleKey; existence = enabled (no isEnabled flag)
- [Phase 05-analytics-repair-intelligence]: Idempotency via 30-day cooldown on asset alert sentinel fields (repeatAlertSentAt, costAlertSentAt, eolAlertSentAt)
- [Phase 05-analytics-repair-intelligence]: AI recommendation freshness check prevents redundant Anthropic API calls on cron re-runs; stored as Json? on MaintenanceAsset

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Verify whether `Organization` model already has a `timezone` field; if not, add it in Phase 1 settings (required for Phase 6 compliance date arithmetic — one-line schema addition, zero risk)
- [Phase 4]: `avoidSchoolYear` flag on PM schedules requires a `SchoolCalendar` model with break date ranges; decide before Phase 4 planning whether to (a) add SchoolCalendar as Phase 4 prerequisite or (b) ship flag as display-only until calendar model exists
- [Phase 6]: FCI calculation scope decision needed: use only closed ticket costs, or include `estimatedRepairCostUSD` on open tickets for deferred maintenance cost? Latter is more useful but requires the field to be added in Phase 2.
- [Phase 7]: Offline PWA sync architecture (serwist/next + dexie + conflict resolution UX) is medium-confidence; recommend a focused research spike before Phase 7 planning begins

## Session Continuity

Last session: 2026-03-06T16:24:44.521Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
