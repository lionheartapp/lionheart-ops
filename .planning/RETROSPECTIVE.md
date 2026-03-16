# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.0 — Events Are the Product

**Shipped:** 2026-03-16
**Phases:** 4 | **Plans:** 34 | **Commits:** 75

### What Was Built
- EventProject hub model with 8-tab workspace, three entry paths (planning seasons, recurring series, direct requests)
- Full public registration system: white-label pages, multi-step form builder, Stripe payments, e-signatures, magic-link parent portal
- Document tracking with completion matrix, group management with drag-and-drop, printable PDFs (bus manifests, cabin rosters, medical summaries)
- Day-of operations: QR check-in, incident logging, offline PWA with Dexie sync, participant self-service
- AI-powered event planning: natural language creation, form/schedule/group generation, budget estimation, conflict detection, status summaries, feedback analysis
- Event templates with AI-enhanced reuse, notification orchestration with automated timelines
- External integrations: Planning Center, Google Calendar, Twilio SMS

### What Worked
- 4-phase structure driven by hard data dependencies (schema first, then services, then UI) kept execution clean
- Two-phase AI pattern (?skipAI=true for instant display, then AI scoring) prevented slow AI calls from blocking UI
- CalendarEvent bridge pattern preserved backward compatibility with existing calendar/planning workflows
- FERPA/COPPA isolation via RegistrationSensitiveData table + separate permission kept compliance clean
- Dynamic imports for cross-service calls (eventProjectService, notificationOrchestrationService, googleCalendarService) prevented circular dependency issues
- Magic link auth with SHA-256 hashed tokens was elegant — parents never need a Lionheart account

### What Was Inefficient
- Nyquist validation not completed for any v3.0 phase — would have caught integration issues earlier
- 22-11 gap closure plan needed after 22-10 "complete" — template UI components were built but not wired
- Smoke tests across Phases 21-22 are all stubs — provides no real regression protection
- EventPeopleTab shipped as placeholder — should have been removed from tab bar or wired to registration data
- 10+ environment variables (STRIPE_*, TURNSTILE_*, PCO_*, GOOGLE_*, CRON_SECRET) not documented in CLAUDE.md

### Patterns Established
- EventProject as hub model — all event-related data connects through eventProjectId
- Public API security: shareSlug-based org resolution (never URL params), Turnstile CAPTCHA, rate limiting
- Portal JWT with explicit 'portal' type claim — clean separation from staff auth
- Day-offset template serialization for portable event templates
- Fire-and-forget pattern for non-critical side effects (email sends, SMS dispatch)
- Separate Dexie database per module (lionheart-events-v1) to prevent version conflicts
- Static slot pattern for React hooks in loops (20 fixed useQuery slots)

### Key Lessons
1. Wire UI components into pages immediately when building them — orphaned components create gap closure work later
2. Two-phase AI fetch pattern is reusable for any AI-augmented view — show data instantly, enhance with AI asynchronously
3. Public-facing security requires layered defense: slug-based org resolution + CAPTCHA + rate limiting + hashed tokens + isolated sensitive data tables
4. When 56 requirements span 34 plans, an audit before completion catches integration gaps the individual plan summaries miss
5. Offline PWA with separate Dexie databases per module is a clean pattern but needs Safari Background Sync fallback

### Cost Observations
- Model mix: ~80% sonnet (execution), ~15% opus (planning/audit), ~5% haiku (parallel workers)
- 75 commits across 2 days of execution
- Notable: Parallelized phase research + plan checking via subagents saved significant wall-clock time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 21 | Established GSD workflow, ~12min/plan |
| v2.0 | 11 | 57 | Production hardening, infrastructure focus |
| v3.0 | 4 | 34 | Largest feature surface, first public-facing pages |

### Cumulative Scale

| Milestone | Total LOC | Models | API Routes | Modules |
|-----------|-----------|--------|------------|---------|
| v1.0 | ~40K | ~25 | ~80 | Maintenance, Campus |
| v2.0 | ~120K | ~45 | ~180 | + IT Help Desk, Athletics, Billing |
| v3.0 | 205K | 66+ | 281+ | + Events (hub), Registration, Integrations |

### Top Lessons (Verified Across Milestones)

1. Hub model pattern works well for complex features — EventProject (v3.0) mirrors the success of MaintenanceTicket (v1.0) as a central organizing entity
2. Org-scoped Prisma extension pattern scales reliably — 66+ models all using the same pattern with no cross-tenant leaks
3. Audit before milestone completion catches issues that per-plan verification misses — worth the investment every time
4. PWA offline with Dexie works across modules but each needs its own database version space
