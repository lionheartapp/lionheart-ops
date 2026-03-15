---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Events Are the Product
status: planning
stopped_at: Completed 19-03-PLAN.md
last_updated: "2026-03-15T03:55:27.010Z"
last_activity: 2026-03-14 — v3.0 roadmap written (4 phases, 56 requirements mapped)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 6
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.
**Current focus:** v3.0 roadmap complete — ready to plan Phase 19

## Current Position

Phase: 19 (Event Foundation) — Not started
Plan: —
Status: Roadmap complete, awaiting phase planning
Last activity: 2026-03-14 — v3.0 roadmap written (4 phases, 56 requirements mapped)

Progress: [░░░░░░░░░░] 0% (v3.0 milestone, 4 phases)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 21
- Average duration: ~12min/plan
- Total execution time: ~4.5 hours

**Velocity (v2.0):**
- Total phases completed: 18
- Total plans completed: 57

**v3.0 velocity:** No data yet (0 plans completed)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0]: EventProject as hub model (not extending CalendarEvent) — events need different data than calendar entries
- [v3.0]: Stripe Elements for payments — PCI compliance, card data never touches Lionheart servers
- [v3.0]: PWA for offline, not native app — works on any phone, no app store
- [v3.0]: Show Everything design — no event type tiers, empty sections serve as checklist
- [v3.0]: Magic link auth for parents — no account creation needed
- [v3.0]: 4 phases (19-22) driven by hard data dependencies per research recommendation
- [v3.0]: Phase 19 is staff-only — no public routes, establishes hub model before any security surface opens
- [v3.0]: Phase 20 opens first public API surface — multi-tenant isolation, CAPTCHA, FERPA/COPPA must be complete before any parent sees a form
- [Phase 19]: EventProject uses separate seriesId FK and sourceId String for series vs planning submission source references
- [Phase 19]: EventActivityLog has no updatedAt — rows are immutable append-only audit trail
- [Phase 19]: DIRECT_REQUEST source creates PENDING_APPROVAL; SERIES/PLANNING_SUBMISSION auto-confirm via confirmEventProject
- [Phase 19]: bulkPublish now returns eventProjectId + calendarEventId instead of eventId; resource requests attach to CalendarEvent bridge for backward compat
- [Phase 19]: confirmEventProject creates CalendarEvent with sourceModule=event-project — canonical bridge record pattern for all EventProjects
- [Phase 19]: PATCH /api/events/projects/[id] requires EVENT_PROJECT_UPDATE_ALL — admin-level change
- [Phase 19]: from-submission accepts APPROVED or PUBLISHED status — covers published planning seasons
- [Phase 19]: Series DELETE uses deactivation (isActive=false) not hard delete — existing projects unaffected

### Pending Todos

- Verify `Organization.timezone` field exists — needed for Phase 22 notification scheduling (add in Phase 19 settings if absent)
- Verify Stripe Connect vs. standard Stripe before Phase 20 planning begins
- Verify Vercel background function availability for PDF generation before Phase 21 planning
- Design Safari Background Sync fallback UX before Phase 21 Dexie work begins
- Verify Planning Center API tier coverage before Phase 22 integration scope is locked

### Blockers/Concerns

- Public-facing security surface is entirely new for Lionheart — rate limiting, spam prevention, untrusted input (addressed in Phase 20 architecture)
- FERPA/COPPA compliance for student medical data, photos, emergency contacts needs careful architecture (RegistrationSensitiveData pattern locked in Phase 20)
- Payment compliance (PCI) requires Stripe Elements — never store raw card data
- Real-time collaboration (WebSocket/SSE) adds infrastructure complexity
- Offline PWA with sync is technically challenging — conflict resolution, queue management (append-only model required)
- Backward compatibility with existing calendar/planning workflows during transition (CalendarEvent bridge preserves this)

## Session Continuity

Last session: 2026-03-15T03:55:27.008Z
Stopped at: Completed 19-03-PLAN.md
Resume file: None
Next action: `/gsd:plan-phase 19`
