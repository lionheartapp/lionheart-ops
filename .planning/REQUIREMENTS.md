# Requirements: Lionheart Maintenance & Facilities Module

**Defined:** 2026-03-05
**Core Value:** Teachers can photograph a broken fixture and submit a maintenance request in under 60 seconds, while the maintenance team sees everything on a Kanban board with AI-assisted diagnostics.

## v1 Requirements

### Schema & Foundation (SCHEMA)

- [x] **SCHEMA-01**: MaintenanceTicket model with 8-status lifecycle, org-scoped, soft-delete
- [x] **SCHEMA-02**: TechnicianProfile model with specialties array, workload cap, loaded hourly rate
- [x] **SCHEMA-03**: TicketActivity model for full audit trail (status changes, comments, assignments)
- [x] **SCHEMA-04**: Maintenance-specific permissions added to Permission table and DEFAULT_ROLES
- [x] **SCHEMA-05**: MaintenanceTicket includes `version` field for future offline sync (Phase 3 prep)
- [x] **SCHEMA-06**: Organization model extended with `timezone` field for compliance date arithmetic (Phase 3 prep)
- [x] **SCHEMA-07**: Auto-incrementing ticket number generation (MT-0001 format)

### Ticket Submission (SUBMIT)

- [x] **SUBMIT-01**: User can select location via Building → Area → Room picker pre-populated from campus
- [x] **SUBMIT-02**: User can enter short title (required) and optional description
- [x] **SUBMIT-03**: User can upload 1–5 photos via signed URL direct-to-Supabase pattern
- [x] **SUBMIT-04**: User can select category from 8 options (Electrical, Plumbing, HVAC, Structural, Custodial/Biohazard, IT/AV, Grounds, Other)
- [x] **SUBMIT-05**: User can set priority (Low / Medium / High / Urgent)
- [x] **SUBMIT-06**: User can add optional availability note for room access
- [x] **SUBMIT-07**: Submitted ticket enters BACKLOG status with auto-assigned specialty tag
- [x] **SUBMIT-08**: AI auto-suggests category when photos are uploaded
- [x] **SUBMIT-09**: AI detects multi-issue submissions and suggests splitting before final submit
- [x] **SUBMIT-10**: Confirmation email sent to submitter with ticket number (MT-XXXX)
- [x] **SUBMIT-11**: Urgent tickets immediately alert Head of Maintenance via email + in-app notification

### Kanban Board (BOARD)

- [x] **BOARD-01**: Kanban board displays columns mapping 1:1 to ticket statuses
- [x] **BOARD-02**: Drag-and-drop moves tickets between columns with role-based validation
- [x] **BOARD-03**: "My Board" view shows only tickets assigned to current technician
- [x] **BOARD-04**: "Campus Board" view shows all tickets for one campus (Head/Admin only)
- [x] **BOARD-05**: "All Campuses" view shows cross-campus tickets with filtering (Head/Admin only)
- [x] **BOARD-06**: Ticket cards show: ID, title, location, priority badge, category tag, assigned tech, age, photo/AI indicators
- [x] **BOARD-07**: Backlog filters: specialty, priority, campus, technician, date range, keyword search, unassigned toggle
- [x] **BOARD-08**: SCHEDULED tickets shown in separate view, not in main backlog

### Ticket Lifecycle (LIFE)

- [x] **LIFE-01**: Status transitions enforced server-side with role validation (BACKLOG→TODO, TODO→IN_PROGRESS, etc.)
- [x] **LIFE-02**: ON_HOLD requires hold reason (PARTS / VENDOR / ACCESS / OTHER) and optional note
- [x] **LIFE-03**: Moving to QA requires completion photo and completion note
- [x] **LIFE-04**: QA→DONE requires Head/Admin sign-off with labor hours and cost confirmed
- [x] **LIFE-05**: QA→IN_PROGRESS (rejection) requires reason note, sent back to tech
- [x] **LIFE-06**: Any→CANCELLED requires cancellation reason, restricted to Head/Admin
- [x] **LIFE-07**: SCHEDULED→BACKLOG transitions automatically on scheduled date
- [x] **LIFE-08**: Full activity feed showing all status changes, comments, assignments with timestamps and actors

### Ticket Detail (DETAIL)

- [x] **DETAIL-01**: Submitter section: name, role, contact info, submitted timestamp, availability note
- [x] **DETAIL-02**: Location section: full hierarchy (Campus → Building → Area → Room), room photo, Google Maps link
- [x] **DETAIL-03**: Issue section: title, description, category, priority, photos (full-size on click)
- [x] **DETAIL-04**: Activity feed with internal comments (tech/head only, not visible to submitter)
- [x] **DETAIL-05**: Assignment and reassignment history logged in activity feed

### AI Diagnostics (AI)

- [x] **AI-01**: AI diagnostic panel triggered lazily when technician first opens ticket with photos
- [x] **AI-02**: AI returns: likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix
- [x] **AI-03**: Confidence indicator displayed (Low / Medium / High) based on photo clarity
- [x] **AI-04**: "Ask AI" button for free-form troubleshooting questions on any ticket
- [x] **AI-05**: PPE / Safety panel auto-shown for Custodial/Biohazard category tickets
- [x] **AI-06**: AI results cached in MaintenanceTicket.aiAnalysis — does not re-run unless new photos added
- [x] **AI-07**: Panel labeled "AI Suggestion — always verify on-site"
- [x] **AI-08**: Uses Anthropic Claude API (not Gemini) for photo analysis

### Specialty Routing (ROUTE)

- [x] **ROUTE-01**: Category auto-maps to specialty tag on ticket creation
- [x] **ROUTE-02**: Technicians can self-claim tickets matching their specialty or GENERAL
- [x] **ROUTE-03**: Head of Maintenance can assign any ticket to any technician regardless of specialty
- [x] **ROUTE-04**: Self-claim guard enforced: techs cannot claim tickets outside their specialty
- [x] **ROUTE-05**: Matching-specialty tickets highlighted in technician's backlog view

### Notifications (NOTIF)

- [x] **NOTIF-01**: Email on ticket submission (to submitter)
- [x] **NOTIF-02**: Email on ticket assignment (to assigned technician)
- [x] **NOTIF-03**: Email when tech self-claims (to Head of Maintenance)
- [x] **NOTIF-04**: Email on status → IN_PROGRESS (to submitter)
- [x] **NOTIF-05**: Email on status → ON_HOLD with hold reason (to submitter + Head)
- [x] **NOTIF-06**: Email on status → QA (to Head of Maintenance)
- [x] **NOTIF-07**: Email on status → DONE (to submitter)
- [x] **NOTIF-08**: Email on urgent ticket submission (to Head of Maintenance)
- [x] **NOTIF-09**: Email when ticket unactioned > 48h (to Head of Maintenance)
- [x] **NOTIF-10**: Email on QA → IN_PROGRESS rejection (to assigned technician)
- [x] **NOTIF-11**: In-app notifications for all email triggers using existing Notification model

### Module & Navigation (NAV)

- [x] **NAV-01**: Maintenance module gated behind AddOns toggle
- [x] **NAV-02**: Sidebar navigation shows Maintenance section when module enabled
- [x] **NAV-03**: Maintenance landing page with Head dashboard overview
- [x] **NAV-04**: Mobile-responsive layout for all maintenance views

### Asset Register (ASSET)

- [x] **ASSET-01**: Asset model with full fields: assetNumber, category, make/model/serial, purchase/warranty dates, replacement cost, photos, notes, status
- [x] **ASSET-02**: Auto-generated asset numbers (AST-0001 format)
- [x] **ASSET-03**: Assets linked to physical hierarchy (building/area/room)
- [x] **ASSET-04**: Asset detail page showing full ticket history, open tickets, upcoming PM, warranty status
- [x] **ASSET-05**: Cumulative repair cost tracked and displayed vs. replacement cost
- [x] **ASSET-06**: Repair threshold alert when cumulative repairs exceed configurable % of replacement cost

### QR Codes (QR)

- [x] **QR-01**: Every asset record generates a unique QR code
- [x] **QR-02**: QR code resolves to asset detail page when scanned
- [x] **QR-03**: Submitters can scan QR to auto-populate location and asset fields on new ticket
- [x] **QR-04**: QR code printable for physical asset tagging
- [x] **QR-05**: Manual asset number entry fallback for iOS camera limitations

### Preventive Maintenance (PM)

- [x] **PM-01**: PmSchedule model with recurrence types (DAILY through CUSTOM), interval, month selection
- [x] **PM-02**: PM schedules linked to assets or locations
- [x] **PM-03**: Default technician assignment per PM schedule
- [x] **PM-04**: School-year-aware scheduling (avoidSchoolYear flag)
- [x] **PM-05**: Configurable advance notice days (default 7) for ticket generation
- [x] **PM-06**: Auto-generated PM tickets enter TODO status with checklist items
- [x] **PM-07**: Checklist items must be completed before tech can move to QA
- [x] **PM-08**: On completion, nextDueDate recalculated from completion date (not scheduled date)
- [x] **PM-09**: PM Calendar view showing all upcoming scheduled maintenance
- [x] **PM-10**: Cron job for PM ticket generation with idempotency via unique constraint (pmScheduleId + scheduledDueDate)

### Labor & Cost Tracking (LABOR)

- [x] **LABOR-01**: Multiple labor entries per ticket (multi-tech, multi-session)
- [x] **LABOR-02**: Labor entry: technician, start/end time, duration, notes
- [x] **LABOR-03**: Labor cost auto-computed from hours × technician's loadedHourlyRate
- [x] **LABOR-04**: Cost/receipt entries: vendor, description, amount, receipt photo upload
- [x] **LABOR-05**: Pre-populated vendor list with autocomplete
- [x] **LABOR-06**: Running cost summary on ticket detail: total labor hours, labor cost, materials cost, combined total
- [x] **LABOR-07**: MaintenanceTicket includes `estimatedRepairCostUSD` field for FCI calculation

### Analytics Dashboard (ANALYTICS)

- [x] **ANALYTICS-01**: Tickets by status count per campus (real-time)
- [x] **ANALYTICS-02**: Average resolution time by category and campus
- [x] **ANALYTICS-03**: Technician workload: active tickets, hours logged per week/month
- [x] **ANALYTICS-04**: PM compliance rate: % completed on time vs overdue
- [x] **ANALYTICS-05**: Labor hours by month, broken down by building and category
- [x] **ANALYTICS-06**: Cost by building per month (materials + labor)
- [x] **ANALYTICS-07**: Top 10 ticket locations
- [x] **ANALYTICS-08**: Category breakdown (ticket volume by specialty)

### Repeat Repair Detection (REPAIR)

- [x] **REPAIR-01**: Auto-detect same asset repaired 3+ times in 12 months, flag with badge
- [x] **REPAIR-02**: Auto-detect cumulative repair cost exceeding repairThresholdPct, generate AI replace-vs-repair recommendation
- [x] **REPAIR-03**: Auto-detect asset age exceeding expectedLifespanYears, flag as "End of Life"
- [x] **REPAIR-04**: Email alerts to Head of Maintenance for all repeat repair detections

### Compliance Calendar (COMPLY)

- [x] **COMPLY-01**: ComplianceRecord model with 10 regulatory domains (AHERA, Fire Safety, Playground, Lead Water, Boiler, Elevator, Kitchen, ADA, Radon, IPM)
- [x] **COMPLY-02**: Admin configures which compliance domains apply to their school
- [x] **COMPLY-03**: System auto-populates compliance calendar with deadlines for the school year
- [x] **COMPLY-04**: 30-day and 7-day email reminders to Head and Admin
- [x] **COMPLY-05**: Each compliance event generates a ticket or PM work order automatically
- [x] **COMPLY-06**: Failed inspection auto-generates follow-up remediation ticket
- [x] **COMPLY-07**: Documentation attachment to compliance records (photos, lab results, certificates)
- [x] **COMPLY-08**: Audit-ready export: one-click PDF of all compliance records for a period

### Board Reporting (REPORT)

- [ ] **REPORT-01**: Facility Condition Index (FCI) calculation: deferred maintenance ÷ total replacement value
- [ ] **REPORT-02**: Board report metrics: FCI, cost per student, PM vs reactive ratio, deferred maintenance backlog
- [ ] **REPORT-03**: Response time and resolution time metrics by campus and category
- [ ] **REPORT-04**: Compliance status: % current vs overdue by domain
- [ ] **REPORT-05**: Asset end-of-life forecast (next 1/3/5 years)
- [ ] **REPORT-06**: Top repair cost assets (replacement candidates)
- [ ] **REPORT-07**: Year-over-year trend comparisons
- [ ] **REPORT-08**: Scheduled automated delivery: weekly to Head, monthly to Admin
- [ ] **REPORT-09**: On-demand PDF generation for any time period and campus
- [ ] **REPORT-10**: AI-generated executive narrative summary via Claude Sonnet

### Knowledge Base (KB)

- [ ] **KB-01**: KnowledgeArticle model with types: Equipment Guide, Procedure SOP, Calculation Tool, Safety Protocol, Vendor Contact, Asset Note
- [ ] **KB-02**: Articles creatable by Tech and Head roles
- [ ] **KB-03**: Embedded calculation tools (e.g., pond care dosage calculator)
- [ ] **KB-04**: AI diagnostic panel can surface relevant knowledge base articles
- [ ] **KB-05**: PM checklists can link to knowledge base articles
- [ ] **KB-06**: Compliance records can link to knowledge base SOPs

### Offline PWA (OFFLINE)

- [ ] **OFFLINE-01**: Progressive Web App with service workers for offline caching
- [ ] **OFFLINE-02**: View assigned tickets offline (cached on device at login)
- [ ] **OFFLINE-03**: Create new tickets offline with photos stored locally
- [ ] **OFFLINE-04**: Update ticket status offline (queued locally)
- [ ] **OFFLINE-05**: Log labor hours and costs offline
- [ ] **OFFLINE-06**: Complete PM checklists offline
- [ ] **OFFLINE-07**: Scan QR codes offline (loads cached asset data)
- [ ] **OFFLINE-08**: Background sync with conflict resolution (last-write-wins for status, merge for comments)
- [ ] **OFFLINE-09**: Connectivity indicator always visible

## v2 Requirements

### Vendor Portal
- **VENDOR-01**: External contractors receive tickets via limited login
- **VENDOR-02**: Contractors update ticket status and log hours

### Parts / Inventory
- **PARTS-01**: ON_HOLD tickets link to parts order with expected arrival date
- **PARTS-02**: Parts order auto-reminder on expected arrival

### Integrations
- **INTEG-01**: SIS integration for auto-provisioning tech and teacher accounts
- **INTEG-02**: Budget integration with financial systems (Munis/Tyler)
- **INTEG-03**: Calendar module event conflict detection for maintenance work

### State-Specific Compliance
- **COMPLY-STATE-01**: CalOSHA and California-specific regulatory requirements
- **COMPLY-STATE-02**: State-specific compliance domain additions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vendor portal / contractor login | Deferred to post-v1; new role type needed |
| Parts/inventory ordering system | Deferred to Phase 2 planning; complexity vs value |
| SIS / roster auto-provisioning | Depends on platform SSO work not yet built |
| Financial system integration (Munis/Tyler) | ERP integration is significant effort; future phase |
| State-specific compliance (CalOSHA) | Deferred to Phase 3 planning; needs state research |
| Submitter status portal | UX addition; Phase 1 decision — may add later |
| Calendar event conflict detection | Lightweight; Phase 1 or 2 decision |
| Real-time WebSocket board updates | Polling with `?since=` timestamp is sufficient for MVP |
| Native mobile app | PWA covers mobile needs |
| Voice-to-text for ticket description | Browser native speech recognition; no custom implementation |

## Traceability

Updated during roadmap creation — 2026-03-05.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Complete |
| SCHEMA-02 | Phase 1 | Complete |
| SCHEMA-03 | Phase 1 | Complete |
| SCHEMA-04 | Phase 1 | Complete |
| SCHEMA-05 | Phase 1 | Complete |
| SCHEMA-06 | Phase 1 | Complete |
| SCHEMA-07 | Phase 1 | Complete |
| NAV-01 | Phase 1 | Complete |
| NAV-02 | Phase 1 | Complete |
| NAV-03 | Phase 1 | Complete |
| NAV-04 | Phase 1 | Complete |
| SUBMIT-01 | Phase 2 | Complete |
| SUBMIT-02 | Phase 2 | Complete |
| SUBMIT-03 | Phase 2 | Complete |
| SUBMIT-04 | Phase 2 | Complete |
| SUBMIT-05 | Phase 2 | Complete |
| SUBMIT-06 | Phase 2 | Complete |
| SUBMIT-07 | Phase 2 | Complete |
| SUBMIT-08 | Phase 2 | Complete |
| SUBMIT-09 | Phase 2 | Complete |
| SUBMIT-10 | Phase 2 | Complete |
| SUBMIT-11 | Phase 2 | Complete |
| LIFE-01 | Phase 2 | Complete |
| LIFE-02 | Phase 2 | Complete |
| LIFE-03 | Phase 2 | Complete |
| LIFE-04 | Phase 2 | Complete |
| LIFE-05 | Phase 2 | Complete |
| LIFE-06 | Phase 2 | Complete |
| LIFE-07 | Phase 2 | Complete |
| LIFE-08 | Phase 2 | Complete |
| DETAIL-01 | Phase 2 | Complete |
| DETAIL-02 | Phase 2 | Complete |
| DETAIL-03 | Phase 2 | Complete |
| DETAIL-04 | Phase 2 | Complete |
| DETAIL-05 | Phase 2 | Complete |
| ROUTE-01 | Phase 2 | Complete |
| ROUTE-02 | Phase 2 | Complete |
| ROUTE-03 | Phase 2 | Complete |
| ROUTE-04 | Phase 2 | Complete |
| ROUTE-05 | Phase 2 | Complete |
| NOTIF-01 | Phase 2 | Complete |
| NOTIF-02 | Phase 2 | Complete |
| NOTIF-03 | Phase 2 | Complete |
| NOTIF-04 | Phase 2 | Complete |
| NOTIF-05 | Phase 2 | Complete |
| NOTIF-06 | Phase 2 | Complete |
| NOTIF-07 | Phase 2 | Complete |
| NOTIF-08 | Phase 2 | Complete |
| NOTIF-09 | Phase 2 | Complete |
| NOTIF-10 | Phase 2 | Complete |
| NOTIF-11 | Phase 2 | Complete |
| BOARD-01 | Phase 3 | Complete |
| BOARD-02 | Phase 3 | Complete |
| BOARD-03 | Phase 3 | Complete |
| BOARD-04 | Phase 3 | Complete |
| BOARD-05 | Phase 3 | Complete |
| BOARD-06 | Phase 3 | Complete |
| BOARD-07 | Phase 3 | Complete |
| BOARD-08 | Phase 3 | Complete |
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 3 | Complete |
| AI-03 | Phase 3 | Complete |
| AI-04 | Phase 3 | Complete |
| AI-05 | Phase 3 | Complete |
| AI-06 | Phase 3 | Complete |
| AI-07 | Phase 3 | Complete |
| AI-08 | Phase 3 | Complete |
| ASSET-01 | Phase 4 | Complete |
| ASSET-02 | Phase 4 | Complete |
| ASSET-03 | Phase 4 | Complete |
| ASSET-04 | Phase 4 | Complete |
| ASSET-05 | Phase 4 | Complete |
| ASSET-06 | Phase 4 | Complete |
| QR-01 | Phase 4 | Complete |
| QR-02 | Phase 4 | Complete |
| QR-03 | Phase 4 | Complete |
| QR-04 | Phase 4 | Complete |
| QR-05 | Phase 4 | Complete |
| PM-01 | Phase 4 | Complete |
| PM-02 | Phase 4 | Complete |
| PM-03 | Phase 4 | Complete |
| PM-04 | Phase 4 | Complete |
| PM-05 | Phase 4 | Complete |
| PM-06 | Phase 4 | Complete |
| PM-07 | Phase 4 | Complete |
| PM-08 | Phase 4 | Complete |
| PM-09 | Phase 4 | Complete |
| PM-10 | Phase 4 | Complete |
| LABOR-01 | Phase 4 | Complete |
| LABOR-02 | Phase 4 | Complete |
| LABOR-03 | Phase 4 | Complete |
| LABOR-04 | Phase 4 | Complete |
| LABOR-05 | Phase 4 | Complete |
| LABOR-06 | Phase 4 | Complete |
| LABOR-07 | Phase 4 | Complete |
| ANALYTICS-01 | Phase 5 | Complete |
| ANALYTICS-02 | Phase 5 | Complete |
| ANALYTICS-03 | Phase 5 | Complete |
| ANALYTICS-04 | Phase 5 | Complete |
| ANALYTICS-05 | Phase 5 | Complete |
| ANALYTICS-06 | Phase 5 | Complete |
| ANALYTICS-07 | Phase 5 | Complete |
| ANALYTICS-08 | Phase 5 | Complete |
| REPAIR-01 | Phase 5 | Complete |
| REPAIR-02 | Phase 5 | Complete |
| REPAIR-03 | Phase 5 | Complete |
| REPAIR-04 | Phase 5 | Complete |
| COMPLY-01 | Phase 6 | Complete |
| COMPLY-02 | Phase 6 | Complete |
| COMPLY-03 | Phase 6 | Complete |
| COMPLY-04 | Phase 6 | Complete |
| COMPLY-05 | Phase 6 | Complete |
| COMPLY-06 | Phase 6 | Complete |
| COMPLY-07 | Phase 6 | Complete |
| COMPLY-08 | Phase 6 | Complete |
| REPORT-01 | Phase 6 | Pending |
| REPORT-02 | Phase 6 | Pending |
| REPORT-03 | Phase 6 | Pending |
| REPORT-04 | Phase 6 | Pending |
| REPORT-05 | Phase 6 | Pending |
| REPORT-06 | Phase 6 | Pending |
| REPORT-07 | Phase 6 | Pending |
| REPORT-08 | Phase 6 | Pending |
| REPORT-09 | Phase 6 | Pending |
| REPORT-10 | Phase 6 | Pending |
| KB-01 | Phase 7 | Pending |
| KB-02 | Phase 7 | Pending |
| KB-03 | Phase 7 | Pending |
| KB-04 | Phase 7 | Pending |
| KB-05 | Phase 7 | Pending |
| KB-06 | Phase 7 | Pending |
| OFFLINE-01 | Phase 7 | Pending |
| OFFLINE-02 | Phase 7 | Pending |
| OFFLINE-03 | Phase 7 | Pending |
| OFFLINE-04 | Phase 7 | Pending |
| OFFLINE-05 | Phase 7 | Pending |
| OFFLINE-06 | Phase 7 | Pending |
| OFFLINE-07 | Phase 7 | Pending |
| OFFLINE-08 | Phase 7 | Pending |
| OFFLINE-09 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 101 total
- Mapped to phases: 101
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 — traceability populated by roadmapper*
