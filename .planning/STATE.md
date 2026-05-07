---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Messaging
status: roadmap_ready
stopped_at: null
last_updated: "2026-05-07T00:00:00.000Z"
last_activity: 2026-05-07 — Roadmap created for v4.0 Messaging (Phases 23-29)
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.
**Current focus:** v4.0 Messaging — Slack-like staff communication integrated with tickets, events, schools, and teams.

## Current Position

Phase: 23 (not started)
Plan: —
Status: Roadmap ready — awaiting phase planning
Last activity: 2026-05-07 — Roadmap created, 7 phases defined (23-29), 43 requirements mapped

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 21
- Average duration: ~12min/plan
- Total execution time: ~4.5 hours

**Velocity (v2.0):**
- Total phases completed: 11
- Total plans completed: 57

**Velocity (v3.0):**
- Total phases completed: 4
- Total plans completed: 34
- Commits: 75
- Files changed: 280
- Lines added: 63,077

**Cumulative:** 22 phases shipped, 112 plans, 3 milestones

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

**v4.0 Decisions made during roadmap creation:**
- Broadcast-from-Database pattern chosen over Postgres Changes (avoids N auth queries per subscriber)
- /api/auth/token endpoint needed to expose JWT to browser Supabase client (httpOnly cookie is not readable by browser JS)
- Denormalized unread counter on ChannelMember (not runtime COUNT(*)) — designed into schema upfront
- Phase 25 (Realtime Bridge) flagged as highest-risk — validate accessToken option against live Supabase before committing UI work
- Phase 29 (Auto-Channels) deferred to last — highest compliance complexity, requires FERPA audit log before student-related channels ship

### Pending Todos

- Note: REQUIREMENTS.md states 37 requirements but actual count is 43. Count in traceability table reflects actual 43.
- Phase 25 research flag: validate Supabase accessToken + custom JWT RLS claims against live project before planning
- Phase 29 research flag: review FERPA retention/export requirements before planning auto-channels

### Blockers/Concerns

- v3.0 tech debt carryover: see MILESTONES.md Known Tech Debt
- Supabase Pro plan connection limit (500 concurrent) — verify current usage before Phase 26 staff rollout
- Web push iOS behavior (Safari PWA requirements) — confirm before committing push as primary notification channel

## Session Continuity

Last session: 2026-05-07
Stopped at: Roadmap created
Resume file: None
Next action: Run /gsd-plan-phase 23
