---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Events Are the Product
status: defining-requirements
stopped_at: null
last_updated: "2026-03-14"
last_activity: 2026-03-14 — Milestone v3.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.
**Current focus:** Defining requirements for v3.0 — Events Are the Product

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-14 — Milestone v3.0 started

Progress: [░░░░░░░░░░] 0% (v3.0 milestone)

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

### Pending Todos

None yet.

### Blockers/Concerns

- Public-facing security surface is entirely new for Lionheart — rate limiting, spam prevention, untrusted input
- FERPA/COPPA compliance for student medical data, photos, emergency contacts needs careful architecture
- Payment compliance (PCI) requires Stripe Elements — never store raw card data
- Real-time collaboration (WebSocket/SSE) adds infrastructure complexity
- Offline PWA with sync is technically challenging — conflict resolution, queue management
- Backward compatibility with existing calendar/planning workflows during transition

## Session Continuity

Last session: 2026-03-14
Stopped at: Defining v3.0 milestone requirements
Resume file: None
