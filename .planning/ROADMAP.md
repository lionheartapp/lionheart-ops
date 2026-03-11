# Roadmap: Lionheart Platform

## Milestones

- ✅ **v1.0 Maintenance & Facilities** — Phases 1-7 (shipped 2026-03-06)
- 🚧 **v2.0 Launch Readiness** — Phases 8-13 (in progress)

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

### Phase 1: Foundation
**Goal**: The maintenance module exists in the platform as a gated add-on with all Prisma models, permissions, and navigation in place, ready for feature development
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07, NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. All 9 new Prisma models are registered in the org-scope extension and a dev-time assertion confirms no model with an `organizationId` column is missing from the whitelist
  2. Maintenance module can be enabled/disabled from the AddOns settings tab and the Maintenance section appears or disappears in the sidebar accordingly
  3. All maintenance-specific permissions are seeded and assignable to roles via the existing roles settings UI
  4. The Maintenance landing page loads without error when the module is enabled and shows a Head of Maintenance overview shell (even if data sections are empty)
  5. All maintenance views are mobile-responsive with correct Tailwind breakpoints and glassmorphism styling
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — 9 Prisma models, enums, org-scope registration, 13 maintenance permissions, and maintenance-head/technician roles
- [x] 01-02-PLAN.md — MODULE_REGISTRY entry, sidebar "Support" section with role-adaptive nav, /maintenance page with dashboard shell and My Requests view

### Phase 2: Core Tickets
**Goal**: Teachers can submit a maintenance ticket in under 60 seconds on mobile, and the maintenance team receives routed tickets with full lifecycle transitions enforced server-side
**Depends on**: Phase 1
**Requirements**: SUBMIT-01, SUBMIT-02, SUBMIT-03, SUBMIT-04, SUBMIT-05, SUBMIT-06, SUBMIT-07, SUBMIT-08, SUBMIT-09, SUBMIT-10, SUBMIT-11, LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, LIFE-07, LIFE-08, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10, NOTIF-11
**Success Criteria** (what must be TRUE):
  1. A teacher can open the submission form, pick a room from the campus hierarchy, upload up to 5 photos, select category and priority, and submit — receiving a confirmation email with ticket number MT-XXXX — in under 60 seconds on a mobile device
  2. An urgent ticket immediately triggers an email and in-app notification to the Head of Maintenance
  3. The server rejects any status transition not in the allowed transitions map and returns 400 INVALID_TRANSITION
  4. ON_HOLD requires a hold reason, QA requires a completion photo and note, and QA-to-DONE requires Head/Admin sign-off — all enforced server-side
  5. A technician can only self-claim tickets matching their specialty or GENERAL; the self-claim guard returns 403 for out-of-specialty attempts
  6. The ticket detail page shows full submitter info, location hierarchy, issue details, and an activity feed with all status changes and internal comments
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Complete backend: ticket service layer with state machine, all CRUD/lifecycle API routes, signed URL photo upload, AI category/multi-issue endpoints, notification dispatch, email templates, dashboard aggregation, and cron job
- [x] 02-02-PLAN.md — Mobile-first 4-step submission wizard (Location > Photos > Details > Review) with AI category suggest, AI multi-issue detection, and My Requests card grid
- [x] 02-03-PLAN.md — Work Orders filtered sortable table with inline actions, specialty highlighting, self-claim with optimistic UI, scheduled tickets section, and live dashboard stats
- [x] 02-04-PLAN.md — Ticket detail page with status tracker, activity feed, comment system, ON_HOLD inline form, QA completion modal, and QA review/sign-off panel

### Phase 3: Kanban & AI
**Goal**: The maintenance team can manage all tickets visually on a Kanban board with drag-and-drop, and technicians get AI-generated diagnostic help on photo tickets
**Depends on**: Phase 2
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08, AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08
**Success Criteria** (what must be TRUE):
  1. Dragging a ticket card to a new column triggers the status transition API; invalid drags are visually rejected and rolled back with an optimistic update; valid drags update the board immediately
  2. A technician sees "My Board" showing only their assigned tickets; a Head sees "Campus Board" and "All Campuses" views with working filters
  3. SCHEDULED tickets appear in their own separate view and do not pollute the main backlog columns
  4. When a technician first opens a ticket with photos, the AI diagnostic panel loads lazily and displays likely diagnosis, suggested tools, suggested parts, step-by-step fix, and a confidence indicator
  5. AI results are cached in `MaintenanceTicket.aiAnalysis`; reopening the same ticket does not trigger a second Anthropic API call unless new photos were added
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Kanban board with dnd-kit drag-and-drop, 6 columns, gate modals, 3 view tabs, technician assign panel, board/table toggle
- [x] 03-02-PLAN.md — AI diagnostic service (Anthropic Claude SDK), diagnosis + ask-ai API routes, AIDiagnosticPanel, PPESafetyPanel, wired into ticket detail

### Phase 4: Assets, QR & PM
**Goal**: Every major piece of equipment has an asset record with QR tag, preventive maintenance runs on a schedule, and all labor and costs are tracked per ticket
**Depends on**: Phase 2
**Requirements**: ASSET-01, ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, QR-01, QR-02, QR-03, QR-04, QR-05, PM-01, PM-02, PM-03, PM-04, PM-05, PM-06, PM-07, PM-08, PM-09, PM-10, LABOR-01, LABOR-02, LABOR-03, LABOR-04, LABOR-05, LABOR-06, LABOR-07
**Success Criteria** (what must be TRUE):
  1. A staff member can scan a QR code on a piece of equipment with their phone and be taken to a pre-populated ticket submission form with location and asset fields already filled in
  2. A PM schedule set to "Monthly" generates a ticket automatically with checklist items and the correct technician assigned; the PM cron job is idempotent
  3. A technician can complete all checklist items on a PM ticket before moving to QA; attempting to move to QA with incomplete checklist items is blocked
  4. A technician can log multiple labor entries and cost entries on a ticket; the running cost summary shows total labor hours, labor cost, materials cost, and combined total
  5. An asset detail page shows cumulative repair cost vs. replacement cost and flags a repair threshold alert when the configurable percentage is exceeded
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Schema updates, asset service with CRUD API, asset register table with filters, create drawer, QR code generation endpoint
- [x] 04-02-PLAN.md — Asset detail page with repair gauge, QR scanning (native + in-app), label printing, manual asset search on ticket wizard
- [x] 04-03-PLAN.md — PM schedule service, CRUD API, creation wizard, calendar view (react-big-calendar), and list view
- [x] 04-04-PLAN.md — PM cron engine for auto-ticket generation, PM checklist UI, QA gate enforcement, next-due-date recalculation
- [x] 04-05-PLAN.md — Labor timer + manual entry, cost/receipt tracking, vendor autocomplete, running cost summary panel on ticket detail

### Phase 5: Analytics & Repair Intelligence
**Goal**: The Head of Maintenance has a real-time operational dashboard and the system automatically flags assets with problematic repair histories
**Depends on**: Phase 4
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06, ANALYTICS-07, ANALYTICS-08, REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04
**Success Criteria** (what must be TRUE):
  1. The analytics dashboard shows ticket counts by status per campus, average resolution time by category, technician workload, PM compliance rate, labor hours by month, cost by building, top 10 ticket locations, and category breakdown
  2. An asset repaired 3 or more times in 12 months is automatically flagged with a "Repeat Repair" badge on its asset record and on any related open ticket
  3. When cumulative repair costs on an asset exceed the configured threshold percentage of replacement cost, the system generates an AI replace-vs-repair recommendation
  4. The Head of Maintenance receives an email alert for each of the three repeat repair detection triggers
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Analytics service with 8 aggregation queries, single API route, and dashboard page with Recharts charts
- [x] 05-02-PLAN.md — Repeat repair detection service, AI replace-vs-repair recommendation (Anthropic Claude), email alerts, and badge display on asset detail and ticket cards

### Phase 6: Compliance & Board Reporting
**Goal**: The school is never caught off-guard by a compliance deadline, and the Head can hand a board-ready FCI report to the superintendent in one click
**Depends on**: Phase 4
**Requirements**: COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04, COMPLY-05, COMPLY-06, COMPLY-07, COMPLY-08, REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10
**Success Criteria** (what must be TRUE):
  1. An admin can configure which of the 10 regulatory domains apply to their school and the system auto-populates the compliance calendar with deadlines for the school year
  2. A failed compliance inspection automatically generates a remediation ticket that enters the normal ticket lifecycle
  3. 30-day and 7-day email reminders for compliance deadlines are delivered to the Head and Admin with working links
  4. A one-click audit export produces a PDF of all compliance records for a selected period
  5. The board report page shows live FCI score, cost per student, PM vs reactive ratio, deferred maintenance backlog, and compliance status by domain
  6. Clicking "Generate Report" produces a downloadable PDF with all board metrics plus an AI-written executive narrative summary
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — ComplianceDomainConfig + ComplianceRecord schema, compliance service, domain config UI with 10-domain card grid, calendar view, and cron reminder endpoint
- [x] 06-02-PLAN.md — Auto-generate MaintenanceTicket from compliance events, remediation ticket on FAILED inspection, document attachment via signed URLs, and jsPDF audit export
- [x] 06-03-PLAN.md — FCI calculation service, board report page with live metric panels, jsPDF export with Claude Sonnet AI narrative, and weekly/monthly cron delivery

### Phase 7: Knowledge Base & Offline PWA
**Goal**: Institutional knowledge is captured and searchable in-app, and technicians can work through poor Wi-Fi with full ticket functionality offline
**Depends on**: Phase 3
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, OFFLINE-01, OFFLINE-02, OFFLINE-03, OFFLINE-04, OFFLINE-05, OFFLINE-06, OFFLINE-07, OFFLINE-08, OFFLINE-09
**Success Criteria** (what must be TRUE):
  1. A technician or Head can create a knowledge article and PM checklists and compliance records can link directly to relevant articles
  2. An embedded calculation tool runs in-browser within a knowledge article without leaving the page
  3. When a technician opens a ticket, the AI diagnostic panel surfaces relevant knowledge base articles alongside the AI diagnosis
  4. With no network connection, a technician can view their assigned tickets, create new tickets with photos stored locally, update ticket status, log labor hours, and complete PM checklists — all queued for sync
  5. When connectivity is restored, the background sync resolves conflicts and displays a connectivity indicator in the UI at all times
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — KnowledgeArticle model with 6 type enum, CRUD service + API routes, article list/editor/viewer UI, pond care dosage calculator, and AI panel KB surfacing
- [x] 07-02-PLAN.md — @serwist/next PWA setup, service worker with NetworkFirst/CacheFirst/StaleWhileRevalidate strategies, PWA manifest + icons, offline fallback page
- [x] 07-03-PLAN.md — Dexie IndexedDB mutation queue, background sync, last-write-wins conflict resolution, and ConnectivityIndicator in DashboardLayout header

</details>

---

### v2.0 Launch Readiness (In Progress)

**Milestone Goal:** Harden the platform for production launch — closing security gaps, completing unfinished features, building missing marketing pages, and establishing operational infrastructure.

- [x] **Phase 8: Auth Hardening and Security** - Production-grade auth: forgot password, rate limiting, httpOnly cookies, CSRF, email verification, input sanitization, and webhook signatures (gap closure in progress) (completed 2026-03-09)
- [x] **Phase 9: Marketing and Legal Pages** - Public pages visitors need before signing up: Privacy Policy, Terms of Service, Pricing, About/Contact, and wired footer (completed 2026-03-10)
- [x] **Phase 10: Inventory System** - Full inventory CRUD, checkout/checkin workflow, transaction log, reorder alerts, and inventory UI page (completed 2026-03-10)
- [x] **Phase 11: Calendar, Ticket, and Feature Gaps** - Draft events individual routes, room conflict detection, ticket drawer edit button, ticket comments/attachments, and ticket search (completed 2026-03-10)
- [x] **Phase 12: Settings and Admin Tools** - Audit log viewer, billing UI, CSV export, org name/slug editing, and notification preferences (completed 2026-03-11)
- [x] **Phase 13: Infrastructure and Observability** - Vitest unit tests, GitHub Actions CI/CD, Pino structured logging, Sentry error tracking, list pagination, and DB transactions (completed 2026-03-11)
- [x] **Phase 14: AI Assistant UX Upgrade** - Button/choice UI in chat, new tools (room availability, resource availability, weather), suggestion chips, rich confirmation cards, smarter event creation flow (completed 2026-03-11)
- [x] **Phase 15: Auth Security Gap Closure** - Rate-limit reset-password endpoint, migrate signup to httpOnly cookies, issue CSRF token on signup (gap closure from v2.0 audit) (completed 2026-03-11)
- [x] **Phase 16: Billing Permission & Observability Retrofit** - Add SETTINGS_BILLING to admin role, retrofit Pino/Sentry instrumentation to 21 routes from Phases 10-15 (gap closure from v2.0 audit) (completed 2026-03-11)

## Phase Details

### Phase 8: Auth Hardening and Security
**Goal**: Users and requests are protected by production-grade security defaults before the platform goes public
**Depends on**: Phases 1-7 (v1.0 complete)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11
**Success Criteria** (what must be TRUE):
  1. User can reset a forgotten password by receiving an email link, clicking it, and setting a new password — the link expires after use
  2. A login attempt from the same IP is blocked after 5 failed attempts within 15 minutes and receives a rate limit error
  3. JWT is stored in an httpOnly cookie — no token value is accessible from JavaScript via document.cookie or localStorage
  4. User who signs up receives a verification email and cannot access the authenticated dashboard until the email link is clicked
  5. Uploading a file with a disallowed MIME type or over the size limit is rejected with a descriptive error before any storage occurs
**Plans**: 7 plans

Plans:
- [x] 08-01-PLAN.md — Forgot password flow: reset token endpoint, email template, reset UI (AUTH-01)
- [x] 08-02-PLAN.md — Rate limiting middleware on login and public endpoints (AUTH-02, AUTH-03)
- [x] 08-03-PLAN.md — httpOnly cookie JWT migration + CSRF protection (AUTH-04, AUTH-05)
- [x] 08-04-PLAN.md — Input sanitization, file upload validation, webhook signature verification (AUTH-06, AUTH-07, AUTH-08, AUTH-11)
- [x] 08-05-PLAN.md — Email verification on signup + password complexity rules (AUTH-09, AUTH-10)
- [ ] 08-06-PLAN.md — Gap closure: Wire PasswordInput into reset-password and set-password pages (AUTH-10)
- [ ] 08-07-PLAN.md — Gap closure: Fix CSRF bypass via directOrgId early-return + migrate client components from manual x-org-id (AUTH-05)

### Phase 9: Marketing and Legal Pages
**Goal**: Visitors can evaluate, trust, and sign up for the platform through complete public pages — no dead links or placeholder text
**Depends on**: Phase 8 (auth flow must be clean and verified before marketing pages direct users into it)
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06
**Success Criteria** (what must be TRUE):
  1. Visitor can read a Privacy Policy page that explicitly addresses COPPA and FERPA data handling for K-12 schools
  2. Visitor can read a Terms of Service page governing platform usage
  3. Visitor can view a Pricing page showing plans and costs before creating an account — no signup required to see pricing
  4. Visitor can view an About page with company information and submit a message through a working Contact form
  5. Every link in the site footer navigates to a real, content-complete page — no 404s or "coming soon" placeholders
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — Privacy Policy + Terms of Service pages with COPPA/FERPA compliance, plus PublicNav/PublicFooter shared components (PAGE-01, PAGE-02)
- [x] 09-02-PLAN.md — Pricing page with three-tier comparison, monthly/annual toggle, feature table, and FAQ (PAGE-03)
- [x] 09-03-PLAN.md — About page with contact form, POST /api/public/contact endpoint, footer link wiring, signup OAuth cleanup + PasswordInput (PAGE-04, PAGE-05, PAGE-06)

### Phase 10: Inventory System
**Goal**: Staff can manage physical inventory — track stock levels, check items in and out, and get alerted before stock runs out
**Depends on**: Phase 8 (auth hardening ensures inventory checkout/checkin actions are properly secured)
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06
**Success Criteria** (what must be TRUE):
  1. Admin can create, edit, and delete an inventory item with name, category, SKU, and quantity
  2. Staff can check out an inventory item and the system records their name, checkout date, and expected return date — available quantity decrements immediately
  3. Staff can check in a returned item and available quantity updates immediately
  4. Admin can view a complete transaction log showing every checkout and checkin event for a given item, with actor and timestamp
  5. Admin sees a visible alert (badge or notification) when an item's quantity drops below the configured reorder threshold
**Plans**: 3 plans

Plans:
- [ ] 10-01-PLAN.md — Schema extension (InventoryItem + InventoryTransaction model), permissions, inventoryService.ts with CRUD + checkout/checkin + low-stock alerts (INV-01, INV-02, INV-03, INV-04, INV-05)
- [ ] 10-02-PLAN.md — All 5 API route handlers with auth/validation, sidebar Inventory nav item, smoke test (INV-01, INV-02, INV-03, INV-04, INV-05)
- [ ] 10-03-PLAN.md — Inventory UI page with search, filters, CRUD drawers, checkout/checkin actions, transaction history, human verification (INV-06)

### Phase 11: Calendar, Ticket, and Feature Gaps
**Goal**: Existing modules have their known gaps closed — draft events are fully manageable, rooms cannot be double-booked, and tickets are more searchable and interactive
**Depends on**: Phase 8 (auth security baseline must be in place before extending API surface)
**Requirements**: CAL-01, CAL-02, TIX-01, TIX-02, TIX-03
**Success Criteria** (what must be TRUE):
  1. Admin can fetch a single draft event by ID, update its fields, and delete it — all via dedicated API routes
  2. Attempting to book a room that already has an event at the same time returns a clear conflict error before the event is saved
  3. Clicking the edit button on a ticket in the dashboard drawer opens the ticket edit view (no dead button)
  4. User can add a comment and attach a file to a generic ticket, and both appear in the ticket detail view
  5. User can search tickets by typing a keyword and seeing results filtered live by matching title or description
**Plans**: 3 plans

Plans:
- [ ] 11-01-PLAN.md — Draft events [id] route (GET/PUT/DELETE) + room conflict detection in eventService + smoke test (CAL-01, CAL-02)
- [ ] 11-02-PLAN.md — TicketComment/TicketAttachment schema, ticket [id] route, comment/attachment services + API routes, keyword search (TIX-02, TIX-03)
- [ ] 11-03-PLAN.md — Dashboard ticket drawer edit button wiring + ticket smoke test + human verification (TIX-01)

### Phase 12: Settings and Admin Tools
**Goal**: Admins have full visibility into platform activity and full control over their organization configuration
**Depends on**: Phase 8 (audit log and billing require a verified, hardened admin session)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05
**Success Criteria** (what must be TRUE):
  1. Admin can open a dedicated Settings tab and browse a paginated list of all org audit log entries, each showing actor, action, target, and timestamp
  2. Org admin can view their current subscription plan, billing cycle, and payment details in a Settings tab
  3. Admin can click Export and download a CSV file of users, tickets, or events from the Settings panel
  4. Admin can change the organization name or subdomain slug after initial signup and the change takes effect without re-logging in
  5. User can open their notification preferences and toggle which email and in-app notification types they receive
**Plans**: 3 plans

Plans:
- [ ] 12-01-PLAN.md — Audit log viewer tab in Settings + CSV export API routes for users/tickets/events + MembersTab export button (SET-01, SET-03)
- [ ] 12-02-PLAN.md — Billing/subscription management tab with plan comparison, plan change with Stripe proration, invoice history, payment portal (SET-02)
- [ ] 12-03-PLAN.md — Org name/slug editing in SchoolInfoTab + NotificationPreference schema + per-user notification preferences UI in profile (SET-04, SET-05)

### Phase 13: Infrastructure and Observability
**Goal**: The platform is observable, testable, and safe to continuously deploy — with structured logs, error tracking, CI/CD, and consistent data access patterns
**Depends on**: Phases 8-12 (infrastructure should wrap the completed, hardened feature set)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. Opening a pull request to main triggers a GitHub Actions run that executes Vitest tests, ESLint, and TypeScript type-check — failing checks block merge
  2. A runtime error in a production API route appears in Sentry within minutes, with request context and the user's org ID attached
  3. Application logs are structured JSON with log levels (info, warn, error) — no raw console.error calls remain in route handlers
  4. Any list endpoint called with `?page=1&limit=25` returns the correct subset of results plus total count
  5. Multi-model write operations execute inside database transactions — a failure in any step rolls back all changes
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — Vitest setup, Prisma mock singleton, auth/permissions/org-context unit tests, and CI pipeline with type-check + lint + test (INFRA-01, INFRA-02)
- [ ] 13-02-PLAN.md — Pino logger singleton, Sentry instrumentation, global-error boundary, and console.* migration in 24 route handler files (INFRA-03, INFRA-04)
- [ ] 13-03-PLAN.md — Shared pagination utility, 6 list endpoint retrofits, database transaction wrapping, and tickets route test (INFRA-05, INFRA-06)

### Phase 14: AI Assistant UX Upgrade
**Goal**: The AI assistant (Leo) provides a rich conversational experience with tappable button choices, contextual suggestion chips, new tools for room/resource availability and weather, and a smarter event creation flow with rich confirmation cards
**Depends on**: Leo persona + SSE streaming (already shipped)
**Requirements**: AI-UX-01, AI-UX-02, AI-UX-03, AI-UX-04, AI-UX-05
**Success Criteria** (what must be TRUE):
  1. When Leo asks a question with choices, tappable button options appear below the message — clicking one sends that choice as a user message
  2. After Leo responds with data, contextual suggestion chips appear (e.g., "Show by category", "Compare to last month") — clicking one sends that suggestion
  3. Asking "Is the gym available Friday at 7pm?" calls check_room_availability and returns a clear yes/no with conflict details if booked
  4. Asking "What's the weather for March 20?" calls get_weather_forecast and returns forecast data
  5. Creating an event via Leo shows a rich confirmation card with editable fields, resource availability warnings, and approval chain preview
**Plans**: 3 plans

Plans:
- [ ] 14-01-PLAN.md — Extend types, SSE marker parsing, system prompt, ChoiceButtons + SuggestionChips components (AI-UX-01, AI-UX-02)
- [ ] 14-02-PLAN.md — 4 new tools: room availability, room finder, resource availability, weather forecast (AI-UX-03, AI-UX-04)
- [ ] 14-03-PLAN.md — Rich event confirmation card with editable fields, resource warnings, and approval preview (AI-UX-05)

### Phase 15: Auth Security Gap Closure
**Goal**: All auth security mechanisms apply uniformly — no public endpoint bypasses rate limiting, and no auth flow falls back to localStorage
**Depends on**: Phase 8 (closes tech debt from auth hardening)
**Requirements**: AUTH-02, AUTH-03, AUTH-04, AUTH-05 (hardening — already satisfied, this closes implementation gaps)
**Gap Closure:** Closes integration/flow gaps from v2.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. `/api/auth/reset-password` is covered by `publicApiRateLimiter` in middleware — same limits as forgot-password and set-password
  2. `POST /api/organizations/signup` response sets `auth-token` and `csrf-token` httpOnly cookies (matching login route pattern)
  3. Signup page no longer writes JWT to localStorage — cookie-based auth from first session
**Plans**: 1 plan

Plans:
- [ ] 15-01-PLAN.md — Rate-limit reset-password, set httpOnly cookies on signup, remove localStorage JWT from signup page (AUTH-02, AUTH-03, AUTH-04, AUTH-05)

### Phase 16: Billing Permission & Observability Retrofit
**Goal**: Close the last 3 audit gaps — billing permission assignment for admin users and Pino/Sentry instrumentation for 21 routes added after Phase 13
**Depends on**: Phase 15 (closes remaining v2.0 audit gaps)
**Requirements**: SET-02, INFRA-03, INFRA-04 (hardening — partially satisfied, this closes integration gaps)
**Gap Closure:** Closes integration/flow gaps from v2.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Admin-role users can access all 4 billing API routes without 403 — `SETTINGS_BILLING` permission assigned to admin role
  2. All 21 routes from Phases 10-15 have `logger.child({ route, method })` Pino instrumentation
  3. All 21 routes from Phases 10-15 have `Sentry.captureException(error)` in catch blocks
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — Add SETTINGS_BILLING to admin role permissions array, backfill script for existing orgs, unit test (SET-02)
- [ ] 16-02-PLAN.md — Retrofit Pino logger and Sentry instrumentation to all 21 routes from Phases 10-15 (INFRA-03, INFRA-04)

---

## Progress

**Execution Order:** 8 → 9 → 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-06 |
| 2. Core Tickets | v1.0 | 4/4 | Complete | 2026-03-06 |
| 3. Kanban & AI | v1.0 | 2/2 | Complete | 2026-03-06 |
| 4. Assets, QR & PM | v1.0 | 5/5 | Complete | 2026-03-06 |
| 5. Analytics & Repair Intelligence | v1.0 | 2/2 | Complete | 2026-03-06 |
| 6. Compliance & Board Reporting | v1.0 | 3/3 | Complete | 2026-03-06 |
| 7. Knowledge Base & Offline PWA | v1.0 | 3/3 | Complete | 2026-03-06 |
| 8. Auth Hardening and Security | 7/7 | Complete   | 2026-03-09 | - |
| 9. Marketing and Legal Pages | 3/3 | Complete   | 2026-03-10 | - |
| 10. Inventory System | 3/3 | Complete    | 2026-03-10 | - |
| 11. Calendar, Ticket, Feature Gaps | 3/3 | Complete    | 2026-03-10 | - |
| 12. Settings and Admin Tools | 3/3 | Complete    | 2026-03-11 | - |
| 13. Infrastructure and Observability | 3/3 | Complete    | 2026-03-11 | - |
| 15. Auth Security Gap Closure | 1/1 | Complete    | 2026-03-11 | - |
| 16. Billing Permission & Observability Retrofit | 2/2 | Complete    | 2026-03-11 | - |
