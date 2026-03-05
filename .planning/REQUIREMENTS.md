# Requirements: Lionheart Maintenance & Facilities Module

**Defined:** 2026-03-05
**Core Value:** Teachers can photograph a broken fixture and submit a maintenance request in under 60 seconds, while the maintenance team sees everything on a Kanban board with AI-assisted diagnostics.

## v1 Requirements

### Schema & Foundation (SCHEMA)

- [ ] **SCHEMA-01**: MaintenanceTicket model with 8-status lifecycle, org-scoped, soft-delete
- [ ] **SCHEMA-02**: TechnicianProfile model with specialties array, workload cap, loaded hourly rate
- [ ] **SCHEMA-03**: TicketActivity model for full audit trail (status changes, comments, assignments)
- [ ] **SCHEMA-04**: Maintenance-specific permissions added to Permission table and DEFAULT_ROLES
- [ ] **SCHEMA-05**: MaintenanceTicket includes `version` field for future offline sync (Phase 3 prep)
- [ ] **SCHEMA-06**: Organization model extended with `timezone` field for compliance date arithmetic (Phase 3 prep)
- [ ] **SCHEMA-07**: Auto-incrementing ticket number generation (MT-0001 format)

### Ticket Submission (SUBMIT)

- [ ] **SUBMIT-01**: User can select location via Building → Area → Room picker pre-populated from campus
- [ ] **SUBMIT-02**: User can enter short title (required) and optional description
- [ ] **SUBMIT-03**: User can upload 1–5 photos via signed URL direct-to-Supabase pattern
- [ ] **SUBMIT-04**: User can select category from 8 options (Electrical, Plumbing, HVAC, Structural, Custodial/Biohazard, IT/AV, Grounds, Other)
- [ ] **SUBMIT-05**: User can set priority (Low / Medium / High / Urgent)
- [ ] **SUBMIT-06**: User can add optional availability note for room access
- [ ] **SUBMIT-07**: Submitted ticket enters BACKLOG status with auto-assigned specialty tag
- [ ] **SUBMIT-08**: AI auto-suggests category when photos are uploaded
- [ ] **SUBMIT-09**: AI detects multi-issue submissions and suggests splitting before final submit
- [ ] **SUBMIT-10**: Confirmation email sent to submitter with ticket number (MT-XXXX)
- [ ] **SUBMIT-11**: Urgent tickets immediately alert Head of Maintenance via email + in-app notification

### Kanban Board (BOARD)

- [ ] **BOARD-01**: Kanban board displays columns mapping 1:1 to ticket statuses
- [ ] **BOARD-02**: Drag-and-drop moves tickets between columns with role-based validation
- [ ] **BOARD-03**: "My Board" view shows only tickets assigned to current technician
- [ ] **BOARD-04**: "Campus Board" view shows all tickets for one campus (Head/Admin only)
- [ ] **BOARD-05**: "All Campuses" view shows cross-campus tickets with filtering (Head/Admin only)
- [ ] **BOARD-06**: Ticket cards show: ID, title, location, priority badge, category tag, assigned tech, age, photo/AI indicators
- [ ] **BOARD-07**: Backlog filters: specialty, priority, campus, technician, date range, keyword search, unassigned toggle
- [ ] **BOARD-08**: SCHEDULED tickets shown in separate view, not in main backlog

### Ticket Lifecycle (LIFE)

- [ ] **LIFE-01**: Status transitions enforced server-side with role validation (BACKLOG→TODO, TODO→IN_PROGRESS, etc.)
- [ ] **LIFE-02**: ON_HOLD requires hold reason (PARTS / VENDOR / ACCESS / OTHER) and optional note
- [ ] **LIFE-03**: Moving to QA requires completion photo and completion note
- [ ] **LIFE-04**: QA→DONE requires Head/Admin sign-off with labor hours and cost confirmed
- [ ] **LIFE-05**: QA→IN_PROGRESS (rejection) requires reason note, sent back to tech
- [ ] **LIFE-06**: Any→CANCELLED requires cancellation reason, restricted to Head/Admin
- [ ] **LIFE-07**: SCHEDULED→BACKLOG transitions automatically on scheduled date
- [ ] **LIFE-08**: Full activity feed showing all status changes, comments, assignments with timestamps and actors

### Ticket Detail (DETAIL)

- [ ] **DETAIL-01**: Submitter section: name, role, contact info, submitted timestamp, availability note
- [ ] **DETAIL-02**: Location section: full hierarchy (Campus → Building → Area → Room), room photo, Google Maps link
- [ ] **DETAIL-03**: Issue section: title, description, category, priority, photos (full-size on click)
- [ ] **DETAIL-04**: Activity feed with internal comments (tech/head only, not visible to submitter)
- [ ] **DETAIL-05**: Assignment and reassignment history logged in activity feed

### AI Diagnostics (AI)

- [ ] **AI-01**: AI diagnostic panel triggered lazily when technician first opens ticket with photos
- [ ] **AI-02**: AI returns: likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix
- [ ] **AI-03**: Confidence indicator displayed (Low / Medium / High) based on photo clarity
- [ ] **AI-04**: "Ask AI" button for free-form troubleshooting questions on any ticket
- [ ] **AI-05**: PPE / Safety panel auto-shown for Custodial/Biohazard category tickets
- [ ] **AI-06**: AI results cached in MaintenanceTicket.aiAnalysis — does not re-run unless new photos added
- [ ] **AI-07**: Panel labeled "AI Suggestion — always verify on-site"
- [ ] **AI-08**: Uses Anthropic Claude API (not Gemini) for photo analysis

### Specialty Routing (ROUTE)

- [ ] **ROUTE-01**: Category auto-maps to specialty tag on ticket creation
- [ ] **ROUTE-02**: Technicians can self-claim tickets matching their specialty or GENERAL
- [ ] **ROUTE-03**: Head of Maintenance can assign any ticket to any technician regardless of specialty
- [ ] **ROUTE-04**: Self-claim guard enforced: techs cannot claim tickets outside their specialty
- [ ] **ROUTE-05**: Matching-specialty tickets highlighted in technician's backlog view

### Notifications (NOTIF)

- [ ] **NOTIF-01**: Email on ticket submission (to submitter)
- [ ] **NOTIF-02**: Email on ticket assignment (to assigned technician)
- [ ] **NOTIF-03**: Email when tech self-claims (to Head of Maintenance)
- [ ] **NOTIF-04**: Email on status → IN_PROGRESS (to submitter)
- [ ] **NOTIF-05**: Email on status → ON_HOLD with hold reason (to submitter + Head)
- [ ] **NOTIF-06**: Email on status → QA (to Head of Maintenance)
- [ ] **NOTIF-07**: Email on status → DONE (to submitter)
- [ ] **NOTIF-08**: Email on urgent ticket submission (to Head of Maintenance)
- [ ] **NOTIF-09**: Email when ticket unactioned > 48h (to Head of Maintenance)
- [ ] **NOTIF-10**: Email on QA → IN_PROGRESS rejection (to assigned technician)
- [ ] **NOTIF-11**: In-app notifications for all email triggers using existing Notification model

### Module & Navigation (NAV)

- [ ] **NAV-01**: Maintenance module gated behind AddOns toggle
- [ ] **NAV-02**: Sidebar navigation shows Maintenance section when module enabled
- [ ] **NAV-03**: Maintenance landing page with Head dashboard overview
- [ ] **NAV-04**: Mobile-responsive layout for all maintenance views

### Asset Register (ASSET)

- [ ] **ASSET-01**: Asset model with full fields: assetNumber, category, make/model/serial, purchase/warranty dates, replacement cost, photos, notes, status
- [ ] **ASSET-02**: Auto-generated asset numbers (AST-0001 format)
- [ ] **ASSET-03**: Assets linked to physical hierarchy (building/area/room)
- [ ] **ASSET-04**: Asset detail page showing full ticket history, open tickets, upcoming PM, warranty status
- [ ] **ASSET-05**: Cumulative repair cost tracked and displayed vs. replacement cost
- [ ] **ASSET-06**: Repair threshold alert when cumulative repairs exceed configurable % of replacement cost

### QR Codes (QR)

- [ ] **QR-01**: Every asset record generates a unique QR code
- [ ] **QR-02**: QR code resolves to asset detail page when scanned
- [ ] **QR-03**: Submitters can scan QR to auto-populate location and asset fields on new ticket
- [ ] **QR-04**: QR code printable for physical asset tagging
- [ ] **QR-05**: Manual asset number entry fallback for iOS camera limitations

### Preventive Maintenance (PM)

- [ ] **PM-01**: PmSchedule model with recurrence types (DAILY through CUSTOM), interval, month selection
- [ ] **PM-02**: PM schedules linked to assets or locations
- [ ] **PM-03**: Default technician assignment per PM schedule
- [ ] **PM-04**: School-year-aware scheduling (avoidSchoolYear flag)
- [ ] **PM-05**: Configurable advance notice days (default 7) for ticket generation
- [ ] **PM-06**: Auto-generated PM tickets enter TODO status with checklist items
- [ ] **PM-07**: Checklist items must be completed before tech can move to QA
- [ ] **PM-08**: On completion, nextDueDate recalculated from completion date (not scheduled date)
- [ ] **PM-09**: PM Calendar view showing all upcoming scheduled maintenance
- [ ] **PM-10**: Cron job for PM ticket generation with idempotency via unique constraint (pmScheduleId + scheduledDueDate)

### Labor & Cost Tracking (LABOR)

- [ ] **LABOR-01**: Multiple labor entries per ticket (multi-tech, multi-session)
- [ ] **LABOR-02**: Labor entry: technician, start/end time, duration, notes
- [ ] **LABOR-03**: Labor cost auto-computed from hours × technician's loadedHourlyRate
- [ ] **LABOR-04**: Cost/receipt entries: vendor, description, amount, receipt photo upload
- [ ] **LABOR-05**: Pre-populated vendor list with autocomplete
- [ ] **LABOR-06**: Running cost summary on ticket detail: total labor hours, labor cost, materials cost, combined total
- [ ] **LABOR-07**: MaintenanceTicket includes `estimatedRepairCostUSD` field for FCI calculation

### Analytics Dashboard (ANALYTICS)

- [ ] **ANALYTICS-01**: Tickets by status count per campus (real-time)
- [ ] **ANALYTICS-02**: Average resolution time by category and campus
- [ ] **ANALYTICS-03**: Technician workload: active tickets, hours logged per week/month
- [ ] **ANALYTICS-04**: PM compliance rate: % completed on time vs overdue
- [ ] **ANALYTICS-05**: Labor hours by month, broken down by building and category
- [ ] **ANALYTICS-06**: Cost by building per month (materials + labor)
- [ ] **ANALYTICS-07**: Top 10 ticket locations
- [ ] **ANALYTICS-08**: Category breakdown (ticket volume by specialty)

### Repeat Repair Detection (REPAIR)

- [ ] **REPAIR-01**: Auto-detect same asset repaired 3+ times in 12 months, flag with badge
- [ ] **REPAIR-02**: Auto-detect cumulative repair cost exceeding repairThresholdPct, generate AI replace-vs-repair recommendation
- [ ] **REPAIR-03**: Auto-detect asset age exceeding expectedLifespanYears, flag as "End of Life"
- [ ] **REPAIR-04**: Email alerts to Head of Maintenance for all repeat repair detections

### Compliance Calendar (COMPLY)

- [ ] **COMPLY-01**: ComplianceRecord model with 10 regulatory domains (AHERA, Fire Safety, Playground, Lead Water, Boiler, Elevator, Kitchen, ADA, Radon, IPM)
- [ ] **COMPLY-02**: Admin configures which compliance domains apply to their school
- [ ] **COMPLY-03**: System auto-populates compliance calendar with deadlines for the school year
- [ ] **COMPLY-04**: 30-day and 7-day email reminders to Head and Admin
- [ ] **COMPLY-05**: Each compliance event generates a ticket or PM work order automatically
- [ ] **COMPLY-06**: Failed inspection auto-generates follow-up remediation ticket
- [ ] **COMPLY-07**: Documentation attachment to compliance records (photos, lab results, certificates)
- [ ] **COMPLY-08**: Audit-ready export: one-click PDF of all compliance records for a period

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

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 101 total
- Mapped to phases: 0
- Unmapped: 101

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after initial definition*
