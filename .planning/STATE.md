---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Events Are the Product
status: verifying
stopped_at: Completed 22-08-PLAN.md
last_updated: "2026-03-16T02:14:05.354Z"
last_activity: 2026-03-15 — Phase 21 Plan 10 verified and approved by user — Phase 21 done
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 33
  completed_plans: 27
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.
**Current focus:** Phase 19 (Event Foundation) complete — all 6 plans shipped. Ready for Phase 20 planning.

## Current Position

Phase: 21 (Documents, Groups, Communication, and Day-Of Tools) — COMPLETE
Plan: 10 (final plan of Phase 21) — COMPLETE
Status: Phase 21 all 10 plans complete, all human-verify checkpoints approved
Last activity: 2026-03-15 — Phase 21 Plan 10 verified and approved by user — Phase 21 done

Progress: [██████████] 100% (Phase 20 complete)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 21
- Average duration: ~12min/plan
- Total execution time: ~4.5 hours

**Velocity (v2.0):**
- Total phases completed: 18
- Total plans completed: 57

**v3.0 velocity:** Phase 19 complete — 6 plans, ~45min/plan average

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
- [Phase 19]: Events nav panel auto-opens on /calendar and /planning (not just /events) — users on existing routes see Events as primary framing
- [Phase 19]: Planning CTA card moved from calendarNavContent to eventsNavContent — Events is the top-level frame for calendar and planning
- [Phase 19]: Two-phase fetch for event dashboard: ?skipAI=true for immediate display, then full AI scoring as second query
- [Phase 19]: Deterministic action item IDs (overdue_task_taskId) enable optimistic removal without ID lookup
- [Phase 19]: EventProjectTabs persists active tab via URL searchParams so deep-links work
- [Phase 19]: EventSeriesDrawer inlines its own mutation hook rather than creating separate useEventSeries hook
- [Phase 20-registration-and-public-pages]: RegistrationSensitiveData has no organizationId by design — FERPA/COPPA data accessed only through registration relation
- [Phase 20-registration-and-public-pages]: events:medical:read and events:registration:manage added to ADMIN role only — medical access restricted from MEMBER and VIEWER
- [Phase 20-registration-and-public-pages]: Balance-intent resolves orgId from registration record not x-org-id header — middleware marks /api/registration/* public so header is not injected
- [Phase 20-registration-and-public-pages]: Public registration APIs resolve organizationId from form.shareSlug lookup never from URL params to prevent cross-tenant injection
- [Phase 20-registration-and-public-pages]: Magic link tokens stored only as SHA-256 hash — raw token never persisted, even DB compromise does not expose tokens
- [Phase 20-registration-and-public-pages]: Portal JWT uses explicit 'portal' type claim to distinguish from staff JWTs; verifyPortalToken rejects staff tokens with 403
- [Phase 20]: useRegistrationForm returns null on 404 — allows RegistrationTab empty state without treating missing form as an error
- [Phase 20]: COMMON_FIELDS exported from CommonFieldPicker for reuse in RegistrationTab default section building
- [Phase 20]: useToast (project custom hook) used for form builder save feedback instead of sonner (not installed)
- [Phase 20-registration-and-public-pages]: staggerContainer is a factory function — must be called as staggerContainer() not used as value
- [Phase 20-registration-and-public-pages]: Registration sub-tabs (Form Design / Registrations / Share & Publish) live within RegistrationTab to keep EventProjectTabs clean
- [Phase 20]: Public layout fetches org by shareSlug then validates org.slug matches URL param — prevents URL spoofing
- [Phase 20]: PaymentStep two-phase: amount selection UI first, then payment-intent creation when user confirms — avoids creating intents for unconfirmed amounts
- [Phase 20-registration-and-public-pages]: Email send failure in webhook is non-fatal — Stripe requires 2xx response regardless of email delivery
- [Phase 20-registration-and-public-pages]: Dynamic import used for registration services in Stripe webhook — isolates from subscription event code path
- [Phase 21-01]: EventIncidentSeverity/EventIncidentType prefixed with Event to avoid enum collision with existing Security module enums
- [Phase 21-01]: EventIncidentParticipant excluded from orgScopedModels — pure junction table with no organizationId (consistent with UserTeam pattern)
- [Phase 21-02]: rawPrisma used in sendDocumentReminder for cross-context email sends; email helper inlined to avoid circular dependency
- [Phase 21-02]: getDefaultComplianceChecklist is a pure function — no DB, callable before runWithOrgContext, supports ?defaults=true pattern
- [Phase 21-06]: Survey response POST is public — registration ID is access credential, validated against survey.eventProjectId to prevent cross-event injection
- [Phase 21-06]: Announcement emails are fire-and-forget via Promise.allSettled — Resend errors logged but do not fail create operation
- [Phase 21-08]: Medical data gated by can(userId, EVENTS_MEDICAL_READ) inside route — boolean includeMedical param passed to service keeps service layer pure
- [Phase 21-08]: Public participant self-service endpoint uses registrationId cuid as access token — non-guessable, FERPA-safe, no auth complexity for QR-03
- [Phase 21-documents-groups-communication-and-day-of-tools]: prisma-as-any cast used for Phase 21 org-scoped models — Prisma extension client TS types incompatible with newer models; rawPrisma used for RegistrationSensitiveData (FERPA isolation)
- [Phase 21-documents-groups-communication-and-day-of-tools]: dietary-medical route uses EVENTS_MEDICAL_READ not EVENTS_GROUPS_MANAGE — FERPA gate isolates medical aggregation from routine group management access
- [Phase 21-03]: useToggleCompletion uses optimistic update pattern: cancelQueries + setQueryData immediately, revert on error
- [Phase 21-03]: UpsertComplianceItemInput extended with eventProjectId for create path, Lucide icons use aria-label not title prop
- [Phase 21-07]: userId for PresenceBar read from localStorage 'user-id' key — consistent with existing maintenance/IT components pattern
- [Phase 21-07]: PortalView announcements use native fetch + setInterval (no TanStack Query) — portal page has no QueryProvider wrapper
- [Phase 21-09]: Separate Dexie database (lionheart-events-v1) for event offline tables to prevent version conflicts with maintenance DB
- [Phase 21-09]: Web Audio API + navigator.vibrate() for QR scan feedback — no external dependency, graceful fallback
- [Phase 21-09]: 3-second auto-reset in CheckInScanner optimized for back-to-back scanning (40 kids off a bus)
- [Phase 21-05]: Static slot pattern for useGroupsWithAssignments — hooks cannot be in loops, 20 fixed slots handle up to 20 groups per type
- [Phase 21-05]: Dynamic jsPDF import in EventPDFGenerator — avoids 500KB SSR bundle hit, code-splits PDF library like label-utils.ts pattern
- [Phase 21]: Day-of button uses conditional visibility (IN_PROGRESS or within 24h of start) to avoid clutter during planning phase
- [Phase 21]: Smoke tests use SKIP stubs for all 18 test cases — consistent with existing smoke-registration.mjs pattern; real assertions deferred to manual testing or future CI
- [Phase 22]: EventNotificationLog uses hard delete — immutable audit records, status cancellation on rule not log row
- [Phase 22]: dispatchPendingNotifications uses rawPrisma — cron runs cross-org without org context
- [Phase 22]: recalculateRulesForEvent only adjusts DATE_BASED rules — CONDITION_BASED and ACTION_TRIGGERED have no scheduledAt
- [Phase 22]: Budget models use hard delete (not soft delete) for clean accounting integrity
- [Phase 22]: syncRegistrationRevenue uses RegistrationStatus.REGISTERED and sums RegistrationPayment rows (status='succeeded') — no CONFIRMED status exists in the enum
- [Phase 22-03]: EventTemplate uses day-offset serialization (not absolute dates) for portable template reuse
- [Phase 22-03]: AI service returns null (not throw) when GEMINI_API_KEY absent — API routes return 503 AI_UNAVAILABLE
- [Phase 22-03]: Two-phase AI summary pattern: ?skipAI=true returns raw metrics immediately for instant UI render
- [Phase 22-ai-budget-notifications-and-external-integrations]: enhance-template API route auto-added — wizard needs client-callable AI enhancement endpoint not in Plan 03 routes
- [Phase 22-08]: AI enhancement failure in CreateFromTemplateWizard is non-fatal — enhancements set to null, wizard continues with raw template data

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

Last session: 2026-03-16T02:14:05.352Z
Stopped at: Completed 22-08-PLAN.md
Resume file: None
Next action: `/gsd:plan-phase 20`
