# LIONHEART PLATFORM — Maintenance & Facilities Module
## Feature Specification v1.1 — Full Three-Phase Plan

This document is the definitive specification for the Lionheart Maintenance & Facilities module. It incorporates requirements gathered from Linfield's facilities team (Feb 12, 2026 meeting), the original v1.0 spec, and a comprehensive market analysis of K-12 CMMS platforms.

## Phase Overview

| Phase | Name | Core Focus | Key Deliverable |
|-------|------|-----------|-----------------|
| Phase 1 | MVP | Ticket submission, Kanban board, AI diagnostics, notifications | Replace SchoolDude for day-to-day ticket management |
| Phase 2 | Operations | Preventive maintenance, asset register, QR codes, labor/cost tracking, analytics | Proactive facilities management with data-driven decisions |
| Phase 3 | Intelligence | Compliance calendar, board reporting, FCI scoring, offline mobile, repeat repair detection | Market-differentiating compliance automation and executive reporting |

---

## PART I — Overview & Design Philosophy

### 1. Module Purpose & Design Philosophy

The Lionheart Maintenance & Facilities module replaces disconnected systems — SchoolDude for work orders, email chains for communication, spreadsheets for compliance — with a single campus-aware platform. It serves teachers who report issues, technicians who fix them, the Head of Maintenance who oversees operations, and administrators who must justify facilities budgets to school boards.

### 1.1 Competitive Positioning

The K-12 CMMS market is dominated by Brightly (SchoolDude/Siemens), FMX, and Incident IQ. All three have the same critical gap: no platform offers fully automated compliance tracking across AHERA, NFPA, ADA, EPA lead testing, and state-specific requirements.

| Capability | SchoolDude | FMX | Incident IQ | Lionheart |
|------------|-----------|-----|-------------|-----------|
| K-12 Purpose-Built | ✓ | ✓ | ✓ | ✓ |
| Kanban Board | ✗ | ✗ | ✗ | ✓ |
| AI Photo Diagnosis | ✗ | ✗ | ✗ | ✓ |
| Preventive Maintenance | ✓ | ✓ | ✓ | ✓ (Phase 2) |
| Asset Register + QR | ✓ | ✓ | ✓ | ✓ (Phase 2) |
| Labor + Cost Tracking | ✓ | ✓ | Partial | ✓ (Phase 2) |
| Compliance Calendar | Partial | Partial | Partial | ✓ Full (Phase 3) |
| Board-Ready FCI Reports | Partial | Partial | ✗ | ✓ (Phase 3) |
| True Offline Mobile | ✗ | Partial | ✗ | ✓ (Phase 3) |
| Campus Map Integration | ✗ | ✓ | ✗ | ✓ (existing) |
| Ticket Splitting | ✗ | ✗ | ✗ | ✓ (Phase 1) |

### 1.2 Roles

| Role | Primary Activities | Board Access | Ticket Scope |
|------|-------------------|-------------|-------------|
| Staff / Teacher | Submit tickets, track own request status | Submitter portal only | Own tickets |
| Technician | Work assigned tickets, self-claim by specialty, update status, log hours | Personal Kanban board | Assigned to them |
| Head of Maintenance | Assign, oversee, review analytics, manage compliance calendar, run reports | Full board + all campuses | All tickets, all campuses |
| Admin / Super Admin | Full configuration, reporting, user management | Full access | All tickets |

---

## PHASE 1 — MVP

### PART II — Ticket Submission

#### 2. Ticket Submission

Mobile-first, sub-60-second reporting. A teacher should be able to photograph a broken fixture and submit without training.

#### 2.1 Submission Steps

1. **Select Location** — Building → Area → Room picker, pre-populated from campus. Shows room photo from InteractiveCampusMap if available.
2. **Describe the Issue** — Short title (required) + optional description. Voice-to-text on mobile.
3. **Upload Photo(s)** — 1–5 photos. AI pre-analysis runs in background. Strongly encouraged.
4. **Select Category** — Electrical, Plumbing, HVAC, Structural, Custodial/Biohazard, IT/AV, Grounds, Other. Auto-suggested by AI if photo uploaded.
5. **Set Priority** — Low / Medium / High / Urgent. Urgent immediately alerts Head of Maintenance.
6. **Availability Note** — Optional: 'Room in use until 3pm' or 'OK to access anytime'. MVP placeholder until timetabling module.
7. **Submit** — Ticket created in BACKLOG. Confirmation email sent. Ticket number assigned (MT-XXXX).

**Ticket Splitting**: AI detects multi-issue submissions and suggests splitting before final submission. One issue per ticket enforced.

#### 2.2 Category → Specialty Mapping

| Category | Specialty Tag | PPE / Safety Prompt |
|----------|--------------|-------------------|
| Electrical | ELECTRICAL | None |
| Plumbing | PLUMBING | None (biohazard sub-type triggers prompt) |
| HVAC | HVAC | None |
| Structural | STRUCTURAL | None |
| Custodial / Biohazard | CUSTODIAL | AI surfaces PPE requirements |
| IT / AV | IT_AV | None |
| Grounds | GROUNDS | None |
| Other | GENERAL | None |

#### 2.3 Location Intelligence

- Full hierarchy: Campus → Building → Area → Room
- Room photo from InteractiveCampusMap
- Google Maps deep-link to building address
- Campus map pin link if coordinates exist

---

### PART III — Ticket Lifecycle & Kanban Board

#### 3. Ticket Lifecycle

##### 3.1 Status Definitions

| Status | Column | Who Sets It | Meaning |
|--------|--------|------------|---------|
| BACKLOG | Backlog | System (auto on submit) | Unassigned. AI specialty tag applied. |
| TODO | To Do | Head (assign) or Tech (self-claim) | Assigned. Scheduled, not started. |
| IN_PROGRESS | In Progress | Technician | Actively being worked. |
| ON_HOLD | On Hold / Waiting on Parts | Tech or Head | Paused. Hold reason required. |
| QA | QA / Inspection | Technician | Work complete, pending sign-off. Completion photo required. |
| DONE | Done | Head or Tech | Fully resolved. Submitter notified. |
| SCHEDULED | Scheduled | System or Head | Future-dated ticket. Does not appear as 'overdue' until its scheduled date. |
| CANCELLED | (filtered out) | Head or Admin | Withdrawn. Cancellation reason required. |

##### 3.2 Status Transitions

| From | To | Allowed By | Validation |
|------|----|-----------|-----------|
| BACKLOG | TODO | Head or Tech (self-claim) | Self-claim only on matching specialty or GENERAL |
| TODO | IN_PROGRESS | Assigned Tech | — |
| IN_PROGRESS | ON_HOLD | Tech or Head | Hold reason required |
| ON_HOLD | IN_PROGRESS | Tech or Head | — |
| IN_PROGRESS | QA | Tech | Completion photo + note required |
| QA | DONE | Head or Admin | Labor hours and cost confirmed |
| QA | IN_PROGRESS | Head | Inspection failed — reason required |
| Any | CANCELLED | Head or Admin | Cancellation reason required |
| SCHEDULED | BACKLOG | System (auto) | Triggered on scheduled date |

##### 3.3 Ticket Detail Panel

**Submitter Section**: Name, role, contact info, submitted timestamp, availability note
**Location Section**: Full hierarchy, room photo, Google Maps link, campus map pin
**Issue Section**: Title, description, category, priority, photos, timestamps

**AI Diagnostic Panel** (Technician/Head Only):
- Triggered lazily when technician first opens ticket with photos
- Likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix
- Confidence indicator (Low / Medium / High)
- 'Ask AI' button for free-form troubleshooting
- PPE / Safety panel for Custodial/Biohazard category
- Uses Claude Sonnet, cached per ticket, labeled 'AI Suggestion — always verify on-site'

**Activity Feed**: Status changes, internal comments (tech/head only), hold reasons, assignment history

---

### PART IV — Kanban Board

#### 4. Kanban Board

Primary workspace for maintenance team. Columns map 1:1 to ticket statuses. Drag-and-drop with role-based validation.

##### 4.1 Board Views

| View | Who Sees It | Scope |
|------|------------|-------|
| My Board | Individual Technician | Tickets assigned to them only |
| Campus Board | Head of Maintenance | All tickets for one campus |
| All Campuses | Head of Maintenance | All tickets across all campuses |
| Admin View | Admin / Super Admin | Full access same as Head |

##### 4.2 Ticket Card Elements

- **Ticket ID**: MT-0001 format, campus-prefixed for multi-campus
- **Title**: Short title from submitter
- **Location**: Building → Room
- **Priority Badge**: Color-coded (Urgent=red, High=amber, Medium=blue, Low=gray)
- **Category Tag**: Matches specialty color
- **Assigned Tech**: Avatar/initials or 'Unassigned'
- **Age**: Time since submission, red if past SLA
- **Photo Indicator**: Camera icon
- **AI Indicator**: Sparkle icon if AI analysis ready
- **Asset Link**: Wrench icon if linked to asset (Phase 2)

##### 4.3 Backlog Filters

- By specialty / category
- By priority
- By campus (Head only)
- By assigned technician (Head only)
- By date range
- Search by keyword
- 'Unassigned only' toggle

---

### PART V — Specialty Routing

#### 5. Specialty-Based Routing

1. Ticket submitted → System creates in BACKLOG with category tag
2. AI suggests specialty based on photo + description
3. All techs see backlog, matching-specialty tickets highlighted
4. Head assigns OR tech self-claims (specialty match or GENERAL only)
5. Head override always available

##### 5.2 TechnicianProfile Model

| Field | Type | Notes |
|-------|------|-------|
| userId | String @unique (FK → User) | |
| campusId | String (FK → Campus) | Home campus |
| specialties | MaintenanceSpecialty[] | ELECTRICAL, PLUMBING, HVAC, etc. |
| isHeadOfMaintenance | Boolean @default(false) | Grants full permissions |
| maxActiveTickets | Int? | Optional workload cap |
| loadedHourlyRate | Decimal? | For Phase 2 labor cost |

---

### PART VI — Notifications

#### 6. Email Notifications

| Trigger | Recipient(s) | Subject Line |
|---------|-------------|-------------|
| Ticket submitted | Submitter | Your maintenance request has been received (MT-XXXX) |
| Ticket assigned | Assigned Technician | New ticket assigned to you: [Title] (MT-XXXX) |
| Tech self-claims | Head of Maintenance | [Tech Name] claimed ticket MT-XXXX: [Title] |
| Status → IN_PROGRESS | Submitter | Work has started on your request (MT-XXXX) |
| Status → ON_HOLD | Submitter + Head | Your request is on hold — [Hold Reason] (MT-XXXX) |
| Status → QA | Head of Maintenance | Ticket ready for inspection: MT-XXXX — [Title] |
| Status → DONE | Submitter | Your maintenance request has been resolved (MT-XXXX) |
| Urgent ticket submitted | Head of Maintenance | URGENT: Immediate attention needed — MT-XXXX |
| Ticket unactioned > 48h | Head of Maintenance | Reminder: MT-XXXX has been in backlog 48 hours |
| QA → IN_PROGRESS (rejected) | Assigned Technician | Inspection feedback on MT-XXXX — action required |

---

## PHASE 2 — OPERATIONS

### PART VII — Asset Register & QR Code Tagging

#### 7. Asset Register

Every maintained equipment has a record connecting to full maintenance history, warranty status, expected lifespan, and all tickets filed against it.

##### 7.1 Asset Model

| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | |
| assetNumber | String @unique | AST-0001 format |
| organizationId / campusId | String (FK) | Multi-tenant + campus scoped |
| buildingId / areaId / roomId | String? (FK) | Physical hierarchy |
| name | String | e.g., 'HVAC Unit — Gym Roof' |
| category | AssetCategory enum | HVAC, ELECTRICAL, PLUMBING, etc. |
| make / model / serialNumber | String? | Equipment identification |
| purchaseDate / warrantyExpiry | DateTime? | Warranty triggers PM reminder |
| expectedLifespanYears | Int? | End-of-life forecasting |
| replacementCostUSD | Decimal? | FCI calculation |
| repairThresholdPct | Decimal @default(0.5) | Flag for replacement threshold |
| qrCode | String @unique | URL-encoded QR |
| photos | String[] | Condition documentation |
| notes | String? | Institutional knowledge |
| status | AssetStatus enum | ACTIVE, DECOMMISSIONED, UNDER_REPAIR, REPLACED |

##### 7.2 QR Code Tagging

- Every asset generates a unique QR code
- Scan → opens asset detail page
- Shows: full ticket history, open tickets, PM schedule, warranty, repair cost vs. replacement
- Submitters scan QR to auto-populate location + asset on new ticket

---

### PART VIII — Preventive Maintenance

#### 8. Preventive Maintenance (Recurring Tickets)

##### 8.1 PM Schedule Model

| Field | Type | Notes |
|-------|------|-------|
| id | String @id | |
| organizationId / campusId | String (FK) | |
| assetId | String? (FK → Asset) | Optional (some PMs are location-based) |
| title | String | e.g., 'HVAC Filter Replacement — Gym' |
| specialtyTag | MaintenanceSpecialty | Routes to correct tech |
| assignedToId | String? (FK → User) | Default tech |
| recurrenceType | Enum | DAILY, WEEKLY, MONTHLY, QUARTERLY, etc. |
| recurrenceInterval | Int @default(1) | e.g., 3 + MONTHLY = every 3 months |
| avoidSchoolYear | Boolean @default(false) | Schedule during breaks |
| estimatedDurationHours | Decimal? | Workload planning |
| checklistItems | Json? | Step-by-step checklist |
| nextDueDate | DateTime | Computed from last completion |
| advanceNoticeDays | Int @default(7) | Days before due to generate ticket |
| isActive | Boolean @default(true) | |

##### 8.3 PM Ticket Generation

- Auto-generates ticket X days before due (default 7)
- Generated ticket enters TODO, auto-assigned to default tech
- Includes checklist items tech must complete before QA
- On completion, nextDueDate recalculated from completion date
- Head sees PM Calendar view of all upcoming scheduled maintenance

---

### PART IX — Labor Hours & Cost Tracking

#### 9.1 Labor Entry

| Field | Type | Notes |
|-------|------|-------|
| ticketId | String (FK) | Multiple entries per ticket |
| technicianId | String (FK → User) | |
| startTime / endTime | DateTime | |
| durationHours | Decimal | Computed or manual |
| notes | String? | What was done |
| loadedCostUSD | Decimal | hours × loadedHourlyRate |

#### 9.2 Cost / Receipt Entry

| Field | Type | Notes |
|-------|------|-------|
| ticketId | String (FK) | |
| vendor | String | Pre-populated vendor list with autocomplete |
| description | String | What was purchased |
| amountUSD | Decimal | |
| receiptPhoto | String? | Supabase Storage URL |

---

### PART X — Analytics Dashboard

#### 10.1 Phase 2 — Operational Metrics

- Tickets by Status (real-time)
- Average Resolution Time (daily)
- Technician Workload (real-time)
- PM Compliance Rate (daily)
- Labor Hours by Month (daily)
- Cost by Building (daily)
- Top 10 Ticket Locations (weekly)
- Category Breakdown (weekly)

#### 10.2 Repeat Repair Detection

- Same asset repaired 3+ times in 12 months → Flag + email Head
- Cumulative repair cost exceeds threshold → AI replace-vs-repair recommendation
- Asset age > expected lifespan → Flag as 'End of Life'

---

## PHASE 3 — INTELLIGENCE

### PART XI — Compliance Calendar

#### 11. Compliance Calendar (10 domains)

AHERA, Fire Safety, Playground, Lead in Water, Boiler, Elevator, Kitchen, ADA, Radon, IPM

- Admin configures which domains apply
- Auto-populates calendar with deadlines
- 30-day and 7-day reminders
- Each event generates a ticket/PM work order
- Failed inspection → auto-generates remediation ticket
- All documentation attached to compliance record
- Audit-ready export: one-click PDF

### PART XII — Board-Ready Reporting & FCI Score

#### 12.1 Facility Condition Index

FCI = total deferred maintenance cost ÷ current replacement value

| FCI Range | Rating | Interpretation |
|-----------|--------|---------------|
| 0%–5% | Good | Well-maintained |
| 5%–10% | Fair | Deferred maintenance accumulating |
| 10%–30% | Poor | Capital planning required |
| 30%+ | Critical | Emergency intervention needed |

#### 12.2 Board Report Metrics

FCI, Cost per Student, PM vs. Reactive Ratio, Deferred Maintenance Backlog, Response/Resolution Times, Compliance Status, End-of-Life Forecast, Top Repair Cost Assets, Year-over-Year Trend

#### 12.3 Report Delivery

- Scheduled: weekly to Head, monthly to Admin/CFO
- On-demand PDF export
- AI narrative generation via Claude Sonnet
- Bond measure support with cost-of-deferral projections

### PART XIII — Offline Mobile (PWA)

- Full ticket data cached on device
- Create/update tickets offline
- Log labor and costs offline
- Complete PM checklists offline
- Scan QR codes offline
- Background sync with conflict resolution

### PART XIV — Knowledge Base

- Equipment Guides, Procedure SOPs, Calculation Tools, Safety Protocols, Vendor Contacts, Asset Notes
- Embedded calculators (e.g., pond care dosage)
- AI can surface relevant articles alongside diagnosis
- PM checklists link to knowledge base articles

---

## Data Models

### MaintenanceTicket

| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | |
| ticketNumber | String @unique | MT-0001, MT-0002... |
| organizationId / campusId | String (FK) | |
| buildingId / areaId / roomId | String? (FK) | |
| locationNote | String? | |
| assetId | String? (FK → Asset) | Phase 2 |
| submittedById | String (FK → User) | |
| assignedToId | String? (FK → User) | |
| title / description | String / String? | |
| category | MaintenanceCategory enum | |
| specialtyTag | MaintenanceSpecialty enum | |
| priority | TicketPriority enum | LOW, MEDIUM, HIGH, URGENT |
| status | TicketStatus enum | BACKLOG, TODO, IN_PROGRESS, ON_HOLD, QA, DONE, SCHEDULED, CANCELLED |
| holdReason / holdReasonNote | String? | Required when ON_HOLD |
| scheduledDate | DateTime? | For SCHEDULED status |
| availabilityNote | String? | |
| photos | String[] | Supabase Storage URLs |
| completionPhoto | String? | Required before QA |
| completionNote | String? | |
| aiAnalysis | Json? | Cached AI diagnostic |
| isPmGenerated | Boolean @default(false) | |
| pmScheduleId | String? (FK) | |
| resolvedAt | DateTime? | |

### Supporting Models

- **Asset** — Equipment register (assetNumber, category, serialNumber, replacementCostUSD, qrCode)
- **PmSchedule** — Recurring maintenance (recurrenceType, avoidSchoolYear, checklistItems, nextDueDate)
- **TicketLaborEntry** — Labor hours (technicianId, startTime, endTime, durationHours, loadedCostUSD)
- **TicketCostEntry** — Material costs (vendor, amountUSD, receiptPhoto)
- **TicketActivity** — Audit trail (type, fromStatus, toStatus, isInternalOnly)
- **TechnicianProfile** — Specialty config (specialties[], isHeadOfMaintenance, maxActiveTickets)
- **ComplianceRecord** — Regulatory tracking (domain, scheduledDate, status, documents[])
- **KnowledgeArticle** — Knowledge base (type, title, content, calculatorConfig)

---

## Permissions

| Permission | Super Admin | Admin | Head | Tech | Staff |
|-----------|------------|-------|------|------|-------|
| maintenance:submit | ✓ | ✓ | ✓ | ✓ | ✓ |
| maintenance:read:own | ✓ | ✓ | ✓ | ✓ | ✓ |
| maintenance:read:assigned | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:read:all | ✓ | ✓ | ✓ | — | — |
| maintenance:update:status | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:update:any | ✓ | ✓ | ✓ | — | — |
| maintenance:assign | ✓ | ✓ | ✓ | — | — |
| maintenance:claim | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:comment | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:manage-techs | ✓ | ✓ | ✓ | — | — |
| maintenance:cancel | ✓ | ✓ | ✓ | — | — |
| maintenance:assets:read | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:assets:manage | ✓ | ✓ | ✓ | — | — |
| maintenance:pm:read | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:pm:manage | ✓ | ✓ | ✓ | — | — |
| maintenance:labor:log | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:analytics:read | ✓ | ✓ | ✓ | — | — |
| maintenance:compliance:manage | ✓ | ✓ | ✓ | — | — |
| maintenance:reports:board | ✓ | ✓ | — | — | — |
| maintenance:knowledge:read | ✓ | ✓ | ✓ | ✓ | — |
| maintenance:knowledge:manage | ✓ | ✓ | ✓ | — | — |

---

## API Routes

### Phase 1
- POST /api/tickets — Submit new ticket (Staff+)
- GET /api/tickets — List tickets (role-scoped, Tech+)
- GET /api/tickets/:id — Get ticket detail (Tech+ or submitter)
- PATCH /api/tickets/:id/status — Move to new status (Tech own or Head)
- PATCH /api/tickets/:id/assign — Assign to technician (Head)
- POST /api/tickets/:id/claim — Self-claim ticket (Tech, matching specialty)
- POST /api/tickets/:id/comments — Add internal comment (Tech+)
- POST /api/tickets/:id/photos — Upload photos (Submitter or Tech)
- POST /api/tickets/:id/ai-analysis — Trigger AI analysis (Tech+)
- POST /api/tickets/:id/split — Split into multiple tickets (Head or Tech)
- GET /api/maintenance/board — Kanban board data (Tech+)
- GET /api/maintenance/board/all-campuses — Cross-campus board (Head+)

### Phase 2
- GET/POST /api/assets — Asset CRUD (Tech+/Head+)
- GET /api/assets/:id — Asset detail + history (Tech+)
- GET /api/assets/qr/:code — Resolve QR code (Authenticated)
- GET/POST/PATCH /api/pm-schedules — PM schedule CRUD (Head+)
- POST /api/tickets/:id/labor — Log labor entry (Tech+)
- POST /api/tickets/:id/costs — Log cost/receipt (Tech+)
- GET /api/maintenance/analytics — Operations dashboard (Head+)

### Phase 3
- GET/POST/PATCH /api/compliance — Compliance records (Head+)
- GET /api/maintenance/reports/board — Board report (Admin+)
- GET /api/maintenance/reports/fci — FCI score (Admin+)
- GET/POST /api/knowledge — Knowledge base (Tech+/Head+)
