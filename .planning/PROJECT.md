# Lionheart Maintenance & Facilities Module

## What This Is

A comprehensive K-12 facilities management module for the Lionheart Platform that replaces SchoolDude, email chains, and spreadsheets with a single campus-aware system. It serves teachers who report issues, technicians who fix them, the Head of Maintenance who oversees operations, and administrators who justify facilities budgets to school boards. The module spans ticket management, asset tracking, preventive maintenance, compliance automation, and board-ready reporting.

## Core Value

Teachers can photograph a broken fixture and submit a maintenance request in under 60 seconds, while the maintenance team sees everything on a Kanban board with AI-assisted diagnostics — replacing SchoolDude for day-to-day ticket management.

## Requirements

### Validated

- ✓ Multi-tenant org-scoped architecture — existing
- ✓ Campus/Building/Area/Room physical hierarchy — existing
- ✓ JWT authentication with role-based permissions — existing
- ✓ Email notifications via Resend — existing
- ✓ In-app notification system — existing
- ✓ Module toggle system (AddOnsTab) — existing

### Active

**Phase 1 — MVP:**
- [ ] Mobile-first ticket submission (location picker, photos, categories, priority)
- [ ] 8-status ticket lifecycle (BACKLOG → TODO → IN_PROGRESS → ON_HOLD → QA → DONE → SCHEDULED → CANCELLED)
- [ ] Kanban board with drag-and-drop, role-based views
- [ ] Specialty-based routing and self-claim
- [ ] TechnicianProfile model with specialties
- [ ] AI photo diagnosis panel (Claude Sonnet via Anthropic API)
- [ ] Ask AI free-form troubleshooting
- [ ] PPE/safety prompts for Custodial/Biohazard
- [ ] Ticket splitting (one issue per ticket enforcement)
- [ ] SCHEDULED status for future-dated tickets
- [ ] Email notifications for all ticket lifecycle events
- [ ] Activity feed with internal comments
- [ ] Head of Maintenance dashboard

**Phase 2 — Operations:**
- [ ] Asset register with full equipment history
- [ ] QR code generation and scanning
- [ ] Preventive maintenance recurring schedules
- [ ] PM ticket auto-generation
- [ ] Labor hours logging
- [ ] Cost/receipt tracking with photo upload
- [ ] Repeat repair detection and replace-vs-repair recommendations
- [ ] Analytics dashboard (operational metrics)
- [ ] PM calendar view

**Phase 3 — Intelligence:**
- [ ] Compliance calendar (10 regulatory domains)
- [ ] Auto-generated compliance tickets from failed inspections
- [ ] Board-ready reporting with FCI score
- [ ] AI-generated executive summaries
- [ ] Knowledge base with calculation tools
- [ ] True offline PWA mode

### Out of Scope

- Vendor portal for external contractors — deferred to post-v1 decision
- Parts/inventory ordering system — deferred to Phase 2 planning
- SIS integration / auto-provisioning — depends on platform SSO work
- Budget integration with financial systems (Munis/Tyler) — future phase
- State-specific compliance beyond federal (CalOSHA) — deferred to Phase 3 planning
- Calendar module event conflict detection — lightweight, Phase 1 or 2 decision

## Context

- **Existing codebase**: Lionheart Platform — Next.js 15, Prisma, Supabase/PostgreSQL, multi-tenant
- **Existing Ticket model**: There is an existing `Ticket` model in Prisma schema used for the current basic ticketing system. The maintenance module will introduce a new `MaintenanceTicket` model with the full lifecycle, keeping backward compatibility
- **Campus hierarchy**: Building → Area → Room already exists with InteractiveCampusMap component
- **Current pain points** (from Linfield facilities team meeting, Feb 12, 2026):
  - SchoolDude is being replaced — crashes, poor mobile, no Kanban
  - Multi-issue tickets prevent individual closure and distort labor tracking
  - Future-dated tickets inflate backlog (SCHEDULED status fixes this)
  - Repeat repairs not tracked (drinking fountain: $1,000+ in repairs vs $400 replacement)
  - Institutional knowledge lives in people's heads (pond care formula, chapel setup)
  - No compliance automation across AHERA, NFPA, ADA, etc.
- **AI decision**: Using Anthropic Claude API (not Gemini) for maintenance AI diagnostics
- **Storage**: Supabase Storage for photos, receipts, compliance documents
- **Competitive positioning**: Key differentiators vs SchoolDude/FMX/Incident IQ are Kanban board, AI photo diagnosis, ticket splitting, and Phase 3 compliance automation

## Constraints

- **Tech stack**: Must integrate with existing Next.js 15 + Prisma + Supabase stack
- **Multi-tenancy**: All new models must be org-scoped using existing `runWithOrgContext` pattern
- **Auth**: Must use existing JWT auth + permission system, extended with maintenance-specific permissions
- **UI consistency**: Must follow existing glassmorphism design system (ui-glass classes, Framer Motion animations)
- **Module gating**: Maintenance module must be behind AddOns toggle, accessible when enabled
- **Mobile-first**: Ticket submission must work well on mobile (sub-60-second target)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate MaintenanceTicket model (not extending existing Ticket) | Maintenance tickets have fundamentally different lifecycle, fields, and behaviors | — Pending |
| Claude API for AI diagnostics (not Gemini) | User preference; better for photo analysis and free-form troubleshooting | — Pending |
| Supabase Storage for all file uploads | Consistent with existing infrastructure, native to the stack | — Pending |
| 8-status Kanban (not simplified) | Matches spec exactly; SCHEDULED and QA statuses solve real Linfield pain points | — Pending |
| All 3 phases in single milestone | User wants comprehensive implementation covering MVP through Intelligence | — Pending |

---
*Last updated: 2026-03-05 after initialization*
