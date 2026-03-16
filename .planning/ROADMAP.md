# Roadmap: Lionheart Platform

## Milestones

- ✅ **v1.0 Maintenance & Facilities** — Phases 1-7 (shipped 2026-03-06)
- ✅ **v2.0 Launch Readiness** — Phases 8-18 (completed 2026-03-14)
- 🚧 **v3.0 Events Are the Product** — Phases 19-22 (in progress)

## Phases

<details>
<summary>✅ v1.0 Maintenance & Facilities (Phases 1-7) — SHIPPED 2026-03-06</summary>

- [x] **Phase 1: Foundation** - Schema, permissions, org-scope registration, module gate, and navigation shell (completed 2026-03-06)
- [x] **Phase 2: Core Tickets** - Mobile-first ticket submission, 8-status lifecycle, specialty routing, and all notifications (completed 2026-03-06)
- [x] **Phase 3: Kanban & AI** - Drag-and-drop Kanban board with all views, AI photo diagnosis, and activity feed (completed 2026-03-06)
- [x] **Phase 4: Assets, QR & PM** - Asset register, QR codes, preventive maintenance scheduling, and labor/cost tracking (completed 2026-03-06)
- [x] **Phase 5: Analytics & Repair Intelligence** - Operational analytics dashboard and repeat repair detection (completed 2026-03-06)
- [x] **Phase 6: Compliance & Board Reporting** - 10-domain compliance calendar and FCI board reports with AI narrative (completed 2026-03-06)
- [x] **Phase 7: Knowledge Base & Offline PWA** - Knowledge base with calculators and true offline PWA with sync (completed 2026-03-06)

</details>

<details>
<summary>✅ v2.0 Launch Readiness (Phases 8-18) — COMPLETED 2026-03-14</summary>

- [x] **Phase 8: Auth Hardening** - httpOnly cookie migration, JWT refresh, session management (completed 2026-03-14)
- [x] **Phase 9: Legal & Compliance Pages** - Terms of service, privacy policy, FERPA notice, cookie consent (completed 2026-03-14)
- [x] **Phase 10: Inventory** - Inventory model, CRUD, categorization, low-stock alerts (completed 2026-03-14)
- [x] **Phase 11: Billing** - Stripe subscription billing, plan management, usage metering (completed 2026-03-14)
- [x] **Phase 12: Audit Logs** - Append-only audit trail for all org-scoped mutations (completed 2026-03-14)
- [x] **Phase 13: Unit Tests** - Vitest test suite, 80% coverage threshold, CI enforcement (completed 2026-03-14)
- [x] **Phase 14: CI/CD** - GitHub Actions pipeline, preview deployments, environment promotion (completed 2026-03-14)
- [x] **Phase 15: Structured Logging** - Pino logging, request correlation IDs, Sentry integration (completed 2026-03-14)
- [x] **Phase 16: Pagination** - Cursor-based pagination on all list endpoints (completed 2026-03-14)
- [x] **Phase 17: IT Help Desk** - IT ticket lifecycle, device management, deployment batches (completed 2026-03-14)
- [x] **Phase 18: Athletics** - Sports, seasons, teams, games, tournaments, stats, standings (completed 2026-03-14)

</details>

### v3.0 — Events Are the Product (Phases 19-22)

- [x] **Phase 19: Event Foundation** - EventProject hub model, 8-tab project page, three entry paths, calendar bridge, navigation reorientation, activity log, smart action dashboard (completed 2026-03-15)
- [x] **Phase 20: Registration and Public Pages** - Public event page, form builder, Stripe payments, e-signatures, magic link parent access, participant dashboard, share hub, CAPTCHA, FERPA/COPPA guardrails (completed 2026-03-15)
- [x] **Phase 21: Documents, Groups, Communication, and Day-Of Tools** - Document tracking with signatures, group assignment with drag-and-drop, printable PDFs, QR check-in, offline PWA, incident logging, communication targeting, post-event surveys (completed 2026-03-15)
- [ ] **Phase 22: AI, Budget, Notifications, and External Integrations** - Budget line items, notification orchestration, AI event creation, AI forms/groups/conflict detection, templates, Planning Center, Google Calendar, Twilio SMS

## Phase Details

### Phase 19: Event Foundation
**Goal**: Staff can manage events as structured projects with a full 8-section workspace, three entry paths, a calendar that reads from project data, and a dashboard that surfaces AI-prioritized actions across all active events
**Depends on**: Phases 1-18 (existing platform)
**Requirements**: EVNT-01, EVNT-02, EVNT-03, EVNT-04, EVNT-05, EVNT-06, EVNT-07, EVNT-08, EVNT-09, EVNT-10
**Success Criteria** (what must be TRUE):
  1. Staff can navigate to Events as the top-level sidebar item and see Calendar and Planning nested beneath it; all existing bookmarked URLs redirect 301 without broken links
  2. Staff can open an EventProject page with 8 tabs (Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms) that load without error — empty section states serve as a built-in checklist
  3. Staff can create an EventProject via three distinct paths: publishing a planning season submission, setting up a recurring EventSeries with default schedule and resources, and submitting a direct mid-year request for admin approval
  4. Staff can build a multi-day schedule with time blocks and create/assign tasks with due date, priority, and status — all changes automatically append an entry to the event activity log
  5. The calendar view shows events sourced from EventProject data via the CalendarEvent bridge, and clicking a bridged calendar entry deep-links to the correct EventProject page
  6. The dashboard shows AI-prioritized action items across all active events with one-tap resolution
**Plans**: 6 plans

Plans:
- [x] 19-01-PLAN.md — Prisma schema (5 models, 6 enums), org-scope/soft-delete registration, permissions, seed
- [x] 19-02-PLAN.md — Service layer (eventProjectService, eventSeriesService, activity log, bulkPublish modification)
- [x] 19-03-PLAN.md — API routes (11 endpoints: project CRUD, schedule, tasks, series, approve, from-submission)
- [x] 19-04-PLAN.md — Sidebar refactor (Events top-level), events list page, 8-tab project workspace, activity log UI
- [x] 19-05-PLAN.md — Schedule builder tab (day-by-day blocks) and Tasks tab (status toggle, filters, priority)
- [x] 19-06-PLAN.md — AI-prioritized action dashboard (Gemini scoring, one-tap resolve, summary stats)

### Phase 20: Registration and Public Pages
**Goal**: Parents can discover, register for, and pay for school events on a branded public page without a Lionheart account, and staff can publish events via a share hub with full control over registration, branding, and access
**Depends on**: Phase 19
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08, REG-09, REG-10, REG-11, REG-12, REG-13
**Success Criteria** (what must be TRUE):
  1. Staff can build a registration form with toggleable common fields (name, grade, emergency contacts, dietary, allergies, medications, t-shirt size), custom fields (text, dropdown, checkbox, number, date, file upload), and organize them into named sections that become multi-page form steps with a progress indicator
  2. A parent can open a public event page branded with the school logo and cover image (no Lionheart branding visible) and complete registration with credit card, Apple Pay, or Google Pay via Stripe — including deposit, payment plan, and discount code options
  3. A parent can sign required documents using finger on mobile or typed name on desktop during registration, and receives a confirmation email containing event details and a unique QR code
  4. A parent can re-access their registration portal via a magic link (no account required) and view their schedule stubs, group assignments, announcements, and any outstanding documents — magic link tokens are single-use, expire in 48 hours, and rate-limited to 3 requests per email per hour
  5. Staff can publish an event via the Share hub with link copy, QR code for flyers, email distribution, branding controls, and registration open/close dates; the system enforces capacity limits and automatically promotes waitlisted participants when spots open
  6. All public registration forms pass CAPTCHA validation (Cloudflare Turnstile) and rate limiting; medical and emergency contact data is stored in a separate RegistrationSensitiveData table accessible only to users with the events:medical:read permission; participants under 13 require explicit parental consent before any personal data field is shown
**Plans**: 7 plans

Plans:
- [x] 20-01-PLAN.md — Prisma schema (9 models, 4 enums), org-scope/soft-delete registration, permissions, middleware, Turnstile utility
- [x] 20-02-PLAN.md — Service layer (registrationService, paymentService, emailService) + staff config API + public registration/payment APIs
- [x] 20-03-PLAN.md — Staff form builder UI (CommonFieldPicker, SectionEditor, FormFieldEditor, FormBuilder, RegistrationTab)
- [x] 20-04-PLAN.md — Public event page (white-label layout), multi-step registration wizard, Stripe Payment Element, SignatureField, TurnstileWidget
- [x] 20-05-PLAN.md — Magic link service, portal JWT, confirmation email with QR, parent portal page and PortalView
- [x] 20-06-PLAN.md — Share hub (link copy, QR code, registration window, capacity), registration management list, medical data endpoint
- [x] 20-07-PLAN.md — Stripe webhook wiring, EventProjectTabs integration, smoke tests, human verification

### Phase 21: Documents, Groups, Communication, and Day-Of Tools
**Goal**: Staff can track document completion, assign participants to groups, communicate with targeted audiences, and run day-of operations (QR check-in, incident logging, headcounts) from a PWA that works offline
**Depends on**: Phase 20
**Requirements**: DOC-01, DOC-02, DOC-03, GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, GRP-06, QR-01, QR-02, QR-03, QR-04, QR-05, COM-01, COM-02, COM-04, COM-05
**Success Criteria** (what must be TRUE):
  1. Staff can define required documents per event, view per-participant completion status at a glance, and send targeted reminders only to families with incomplete documents; a compliance checklist covers all off-campus event requirements (insurance, vendor contracts, background checks)
  2. Staff can create groups by type (bus, cabin, small group, activity) with capacity and assigned leader, drag and drop participants between groups, and generate printable PDFs for bus manifests (with medical flags), cabin rosters (with photos), medical summaries, emergency contact sheets, activity rosters, and check-in sheets
  3. Staff can manage elective activity signups with real-time capacity tracking, and parents can see their student's group assignments on the participant dashboard
  4. Staff can post announcements targeted to specific audiences (all registrants, specific group, incomplete-docs families, paid-only), and parents see announcements in real time on the public event page and participant dashboard; multiple staff can collaborate on the event project simultaneously with presence indicators showing who is active
  5. Staff can scan participant QR codes on a PWA for check-in with a real-time counter (checked-in vs. total), log incidents with involved participants and actions taken, and all day-of tools (QR scanning, rosters, headcounts, incident logging) continue working offline with automatic sync on reconnect
  6. Participants can scan their QR code to view personal schedule, group assignments, and event announcements without staff assistance
**Plans**: 10 plans

Plans:
- [x] 21-01-PLAN.md — Prisma schema (14 models, 6 enums), org-scope/soft-delete registration, permissions, shared types
- [x] 21-02-PLAN.md — Document service layer and API routes (requirements CRUD, completion matrix, reminders, compliance)
- [x] 21-03-PLAN.md — Documents tab UI (matrix view, compliance checklist, requirement drawer)
- [x] 21-04-PLAN.md — Group service layer and API routes (groups CRUD, assignments, auto-assign, activities, dietary/medical)
- [x] 21-05-PLAN.md — Logistics tab UI (drag-and-drop groups, activity manager, PDF generator, portal groups)
- [x] 21-06-PLAN.md — Communication service layer and API routes (announcements, surveys, presence)
- [x] 21-07-PLAN.md — Comms tab UI (announcement composer/feed, survey manager, presence bar)
- [x] 21-08-PLAN.md — Day-of service layer and API routes (check-in, incidents, participant self-service)
- [x] 21-09-PLAN.md — Day-of UI (QR scanner, incident form, offline PWA, participant self-service page)
- [x] 21-10-PLAN.md — Integration wiring, middleware updates, smoke tests, human verification

### Phase 22: AI, Budget, Notifications, and External Integrations
**Goal**: Staff can manage event budgets with line-item detail, configure automated notification timelines, use AI to generate forms, schedules, group assignments, and status summaries, save events as templates, and sync events with Planning Center, Google Calendar, and Twilio SMS
**Depends on**: Phase 21
**Requirements**: BUD-01, BUD-02, BUD-03, COM-03 (notification orchestration), AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, AI-11, INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Staff can create a line-item budget with categories (venue, transportation, food, supplies, insurance), log actual expenses with receipt uploads, log revenue (registration fees, sponsorships, fundraising), and view a budget vs. actual report with per-participant cost analysis
  2. Staff can configure an automated notification timeline with date-based triggers (e.g., 14 days before event) and condition-based triggers (e.g., registration not complete); AI drafts the message content; coordinator approves before send; rescheduling the event cancels and re-queues all pending notifications using relative offsets
  3. Staff can describe an event in natural language and have AI auto-fill event details, suggest required documents, generate a starter task list, and estimate a budget range; AI can also generate a registration form from event parameters and produce an initial multi-day schedule
  4. Staff can use AI to generate initial group assignments given constraints (gender, grade, friend requests, counselor ratios), receive AI-detected scheduling conflicts beyond date/room overlap (weather risk, testing schedules, audience overlap), and view AI-generated status summaries on the event Overview tab
  5. Staff can save any completed event as a template and create new events from templates; AI auto-updates dates, adjusts budget estimates, and surfaces lessons learned from the activity log of previous events using the same template
  6. Staff can sync events to Google Calendar, send SMS notifications via Twilio for day-of updates and deadline reminders, and (for schools using Planning Center) sync worship sets, team assignments, and people data — all integrations are module-toggled so absence of credentials does not break core functionality; AI analyzes post-event feedback surveys and surfaces actionable themes
**Plans**: 10 plans

Plans:
- [ ] 22-01-PLAN.md — Budget schema, service layer, and API routes (line items, revenue, receipts, report)
- [ ] 22-02-PLAN.md — Notification orchestration schema, service, API routes, and cron dispatch
- [ ] 22-03-PLAN.md — Event template schema + AI event service (generation, schedule, budget, summary, feedback)
- [ ] 22-04-PLAN.md — Budget tab UI (spreadsheet-style line items, expense drawer, revenue section, report view)
- [ ] 22-05-PLAN.md — Notification timeline UI (visual Gantt-lite builder, rule drawer with AI drafting)
- [ ] 22-06-PLAN.md — AI event creation wizard (chat-style interface, two-panel layout, schedule generation)
- [ ] 22-07-PLAN.md — AI generate-then-edit features (form, groups, conflicts, budget estimation, summaries, feedback)
- [ ] 22-08-PLAN.md — Template UI (save dialog, template browser, create-from-template wizard with AI enhancement)
- [ ] 22-09-PLAN.md — External integrations (Planning Center, Google Calendar, Twilio) services, API routes, settings tab
- [ ] 22-10-PLAN.md — Cross-feature wiring, smoke tests, human verification

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 19. Event Foundation | 6/6 | Complete    | 2026-03-15 |
| 20. Registration and Public Pages | 7/7 | Complete    | 2026-03-15 |
| 21. Documents, Groups, Communication, and Day-Of Tools | 10/10 | Complete    | 2026-03-16 |
| 22. AI, Budget, Notifications, and External Integrations | 3/10 | In Progress|  |
