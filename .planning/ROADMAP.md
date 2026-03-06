# Roadmap: Lionheart Maintenance & Facilities Module

## Overview

This roadmap delivers a complete K-12 CMMS on top of the existing Lionheart platform, replacing SchoolDude for the Linfield team. The build sequence is strictly dependency-ordered: schema and permissions first, then the ticket engine, then the Kanban board and AI differentiators that define the trial experience, then the operations layer (assets, PM, labor), then analytics and repeat repair intelligence, then compliance automation and board reporting, and finally the knowledge base and offline PWA that form the long-term competitive moat. Each phase delivers a coherent, independently verifiable capability and leaves the next phase unblocked.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Schema, permissions, org-scope registration, module gate, and navigation shell (completed 2026-03-06)
- [x] **Phase 2: Core Tickets** - Mobile-first ticket submission, 8-status lifecycle, specialty routing, and all notifications (completed 2026-03-06)
- [x] **Phase 3: Kanban & AI** - Drag-and-drop Kanban board with all views, AI photo diagnosis, and activity feed (completed 2026-03-06)
- [ ] **Phase 4: Assets, QR & PM** - Asset register, QR codes, preventive maintenance scheduling, and labor/cost tracking
- [ ] **Phase 5: Analytics & Repair Intelligence** - Operational analytics dashboard and repeat repair detection
- [ ] **Phase 6: Compliance & Board Reporting** - 10-domain compliance calendar and FCI board reports with AI narrative
- [ ] **Phase 7: Knowledge Base & Offline PWA** - Knowledge base with calculators and true offline PWA with sync

## Phase Details

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
  3. The server rejects any status transition not in the allowed transitions map and returns 400 INVALID_TRANSITION; every valid and invalid pair is covered by a smoke test
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
  2. A technician sees "My Board" showing only their assigned tickets; a Head sees "Campus Board" and "All Campuses" views with working filters (specialty, priority, campus, technician, date range, keyword, unassigned toggle)
  3. SCHEDULED tickets appear in their own separate view and do not pollute the main backlog columns
  4. When a technician first opens a ticket with photos, the AI diagnostic panel loads lazily, displays likely diagnosis, suggested tools, suggested parts, step-by-step fix, and a confidence indicator — all labeled "AI Suggestion — always verify on-site"
  5. Custodial/Biohazard tickets automatically display the PPE/safety panel in the detail view
  6. AI results are cached in `MaintenanceTicket.aiAnalysis`; reopening the same ticket does not trigger a second Anthropic API call unless new photos were added
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Kanban board with dnd-kit drag-and-drop, 6 columns, gate modals, 3 view tabs, technician assign panel, board/table toggle
- [ ] 03-02-PLAN.md — AI diagnostic service (Anthropic Claude SDK), diagnosis + ask-ai API routes, AIDiagnosticPanel, PPESafetyPanel, wired into ticket detail

### Phase 4: Assets, QR & PM
**Goal**: Every major piece of equipment has an asset record with QR tag, preventive maintenance runs on a schedule, and all labor and costs are tracked per ticket
**Depends on**: Phase 2
**Requirements**: ASSET-01, ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, QR-01, QR-02, QR-03, QR-04, QR-05, PM-01, PM-02, PM-03, PM-04, PM-05, PM-06, PM-07, PM-08, PM-09, PM-10, LABOR-01, LABOR-02, LABOR-03, LABOR-04, LABOR-05, LABOR-06, LABOR-07
**Success Criteria** (what must be TRUE):
  1. A staff member can scan a QR code on a piece of equipment with their phone and be taken to a pre-populated ticket submission form with location and asset fields already filled in; manual asset number entry fallback works when camera is unavailable
  2. A PM schedule set to "Monthly" generates a ticket automatically with checklist items and the correct technician assigned; the PM cron job is idempotent and a duplicate run for the same schedule+date does not create a second ticket
  3. A technician can complete all checklist items on a PM ticket before moving to QA; attempting to move to QA with incomplete checklist items is blocked
  4. A technician can log multiple labor entries (start/end time) and cost entries (vendor, amount, receipt photo) on a ticket; the running cost summary shows total labor hours, labor cost, materials cost, and combined total
  5. An asset detail page shows cumulative repair cost vs. replacement cost and flags a repair threshold alert when the configurable percentage is exceeded
**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — Schema updates, asset service with CRUD API, asset register table with filters, create drawer, QR code generation endpoint
- [ ] 04-02-PLAN.md — Asset detail page with repair gauge, QR scanning (native + in-app), label printing, manual asset search on ticket wizard
- [ ] 04-03-PLAN.md — PM schedule service, CRUD API, creation wizard, calendar view (react-big-calendar), and list view
- [ ] 04-04-PLAN.md — PM cron engine for auto-ticket generation, PM checklist UI, QA gate enforcement, next-due-date recalculation
- [ ] 04-05-PLAN.md — Labor timer + manual entry, cost/receipt tracking, vendor autocomplete, running cost summary panel on ticket detail

### Phase 5: Analytics & Repair Intelligence
**Goal**: The Head of Maintenance has a real-time operational dashboard and the system automatically flags assets with problematic repair histories
**Depends on**: Phase 4
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06, ANALYTICS-07, ANALYTICS-08, REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04
**Success Criteria** (what must be TRUE):
  1. The analytics dashboard shows ticket counts by status per campus, average resolution time by category, technician workload, PM compliance rate, labor hours by month, cost by building, top 10 ticket locations, and category breakdown — all updating without page reload
  2. An asset repaired 3 or more times in 12 months is automatically flagged with a "Repeat Repair" badge on its asset record and on any related open ticket
  3. When cumulative repair costs on an asset exceed the configured threshold percentage of replacement cost, the system generates an AI replace-vs-repair recommendation via Claude
  4. An asset whose age exceeds its expected lifespan is flagged as "End of Life" on the asset record
  5. The Head of Maintenance receives an email alert for each of the three repeat repair detection triggers
**Plans**: TBD

Plans:
- [ ] 05-01: Analytics service, API routes, and dashboard with Recharts charts
- [ ] 05-02: Repeat repair detection service, AI replace-vs-repair recommendation, and email alerts

### Phase 6: Compliance & Board Reporting
**Goal**: The school is never caught off-guard by a compliance deadline, and the Head can hand a board-ready FCI report to the superintendent in one click
**Depends on**: Phase 4
**Requirements**: COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04, COMPLY-05, COMPLY-06, COMPLY-07, COMPLY-08, REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10
**Success Criteria** (what must be TRUE):
  1. An admin can configure which of the 10 regulatory domains (AHERA, Fire Safety, Playground, Lead Water, Boiler, Elevator, Kitchen, ADA, Radon, IPM) apply to their school and the system auto-populates the compliance calendar with deadlines for the school year
  2. A failed compliance inspection automatically generates a remediation ticket that enters the normal ticket lifecycle; compliance documents (photos, lab results, certificates) can be attached to compliance records
  3. 30-day and 7-day email reminders for compliance deadlines are delivered to the Head and Admin with working links
  4. A one-click audit export produces a PDF of all compliance records for a selected period
  5. The board report page shows live FCI score, cost per student, PM vs reactive ratio, deferred maintenance backlog, compliance status by domain, asset end-of-life forecast, and top repair cost assets
  6. Clicking "Generate Report" produces a downloadable PDF with all board metrics plus an AI-written executive narrative summary
**Plans**: TBD

Plans:
- [ ] 06-01: Compliance record model, domain configuration, calendar population, and reminders
- [ ] 06-02: Compliance ticket auto-generation, document attachments, and audit PDF export
- [ ] 06-03: FCI calculation, board report page, PDF generation with AI narrative

### Phase 7: Knowledge Base & Offline PWA
**Goal**: Institutional knowledge is captured and searchable in-app, and technicians can work through poor Wi-Fi with full ticket functionality offline
**Depends on**: Phase 3
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, KB-06, OFFLINE-01, OFFLINE-02, OFFLINE-03, OFFLINE-04, OFFLINE-05, OFFLINE-06, OFFLINE-07, OFFLINE-08, OFFLINE-09
**Success Criteria** (what must be TRUE):
  1. A technician or Head can create a knowledge article (Equipment Guide, Procedure SOP, Calculation Tool, Safety Protocol, Vendor Contact, or Asset Note) and PM checklists and compliance records can link directly to relevant articles
  2. An embedded calculation tool (pond care dosage calculator) runs in-browser within a knowledge article without leaving the page
  3. When a technician opens a ticket, the AI diagnostic panel surfaces relevant knowledge base articles alongside the AI diagnosis
  4. With no network connection, a technician can view their assigned tickets, create new tickets with photos stored locally, update ticket status, log labor hours, complete PM checklists, and scan QR codes against cached asset data — all queued for sync
  5. When connectivity is restored, the background sync resolves conflicts using last-write-wins for status and merge for comments, and displays a connectivity indicator in the UI at all times
**Plans**: TBD

Plans:
- [ ] 07-01: Knowledge base model, CRUD, article types, embedded calculators, and AI panel integration
- [ ] 07-02: PWA service worker setup (serwist/next) and offline caching strategy
- [ ] 07-03: IndexedDB mutation queue (dexie), background sync, conflict resolution, and connectivity indicator

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-06 |
| 2. Core Tickets | 4/4 | Complete   | 2026-03-06 |
| 3. Kanban & AI | 2/2 | Complete   | 2026-03-06 |
| 4. Assets, QR & PM | 0/5 | Not started | - |
| 5. Analytics & Repair Intelligence | 0/2 | Not started | - |
| 6. Compliance & Board Reporting | 0/3 | Not started | - |
| 7. Knowledge Base & Offline PWA | 0/3 | Not started | - |
