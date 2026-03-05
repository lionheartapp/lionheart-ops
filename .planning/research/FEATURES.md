# Feature Landscape: K-12 CMMS / Facilities Management Module

**Domain:** K-12 Computerized Maintenance Management System (CMMS)
**Project:** Lionheart Maintenance & Facilities Module
**Researched:** 2026-03-05
**Research Scope:** How features work in production K-12 CMMS systems — SchoolDude (Brightly), FMX, Incident IQ, MaintainX, OperationsHERO

---

## Table Stakes

Features every buyer expects. If these are absent or broken, users leave — or the product never gets past the evaluation call.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Work order / ticket submission | Core workflow — reason the product exists | Low | All K-12 CMMS have this. Mobile-first matters: teachers won't use a desktop form. |
| Basic status lifecycle | New → In Progress → Done is the minimum; buyers expect visual state | Low | SchoolDude has this. The spec's 8-status model (BACKLOG → DONE) is **above** table stakes. |
| Email notifications on status changes | Submitters need to know when work starts and completes | Low | All platforms do this. Requester gets "work started" and "resolved" at minimum. |
| Priority levels | Facilities teams cannot treat a burst pipe the same as a burned-out bulb | Low | 4-tier (Low/Med/High/Urgent) is industry standard. |
| Role-based access (submitter vs. tech vs. admin) | Teachers should not see internal tech comments or cost data | Medium | Standard in all K-12 platforms. Three+ tiers universal. |
| Photo upload on ticket submission | "A picture is worth a thousand words" — techs see the problem before arriving | Low | Standard. Mobile camera integration expected. |
| Campus / location picker | School facilities span multiple buildings; location precision reduces wasted trips | Medium | Campus hierarchy (Building → Room) is standard; K-12 products all include it. |
| Assignment to specific technician | Head of Maintenance must be able to route work | Low | Universal. Manual assignment is baseline; auto-routing is differentiating. |
| Activity feed / audit trail | Compliance and accountability — "who did what and when" | Medium | All mature platforms include this. Especially important for QA status workflows. |
| Basic reporting (count by status, age, type) | Administrators need something to show at district meetings | Medium | All platforms provide some dashboard. Sophistication varies widely. |
| Mobile access for technicians | Techs are not at desks — they are in boiler rooms and on rooftops | Medium | Mobile app or responsive PWA expected in 2026. SchoolDude's poor mobile is its primary failure reason per Linfield's Feb 2026 feedback. |
| Preventive maintenance scheduling | Proactive maintenance is required for HVAC, fire safety, boilers | High | All three major K-12 platforms (SchoolDude, FMX, Incident IQ) offer PM scheduling. Not having it excludes from enterprise bids. |
| Asset register (basic) | Equipment history must be searchable; warranty tracking required | High | Universal in K-12 CMMS. Simple register with name, location, make/model is minimum. |

---

## Differentiators

Features that set Lionheart apart. Users do not expect these from competitors. When they see them, they become reasons to buy or switch.

### Phase 1 Differentiators

| Feature | Value Proposition | Complexity | Competitive Gap |
|---------|-------------------|------------|-----------------|
| **Kanban board (drag-and-drop)** | Techs and managers see work in flight without clicking into rows. Status transitions are visual and immediate. | High | None of SchoolDude, FMX, or Incident IQ have a Kanban board. This is a direct attack on SchoolDude's list-view paradigm. |
| **AI photo diagnosis (Claude Sonnet)** | Technician opens ticket, sees probable cause, suggested tools, step-by-step fix. Reduces diagnostic time and trips. | High | No production K-12 CMMS has AI photo diagnosis as of 2026. OperationsHERO uses photo scanning for asset *creation* (not diagnosis). MaintainX has generic AI features, not photo-to-diagnosis. |
| **AI ticket splitting detection** | AI detects "the HVAC is broken AND the window leaks" — suggests two tickets before submission. Prevents compound tickets from distorting labor tracking. | Medium | No K-12 platform enforces one-issue-per-ticket. This solves a real Linfield pain point (Feb 2026 meeting: multi-issue tickets prevent individual closure). |
| **SCHEDULED status (future-dated tickets)** | Future-dated tickets do not appear as overdue backlog. Backlog is genuinely actionable. | Medium | Standard CMMS systems show scheduled work as overdue if its date has passed — or exclude it from backlog entirely. The spec's explicit SCHEDULED status with auto-promotion to BACKLOG on its due date is uncommon. |
| **Specialty-based self-claim** | Electrical technician can grab unassigned electrical tickets without waiting for the Head of Maintenance to assign. Reduces bottleneck on manager. | Medium | Incident IQ has automatic assignment routing; none have technician self-claim with specialty enforcement. |
| **PPE / safety prompts on Custodial/Biohazard** | OSHA compliance surfaced at point of work, not in a separate training module. Reduces liability exposure. | Low | No K-12 CMMS surfaces contextual PPE prompts at ticket level. Compliance is typically a separate module. |
| **QA status (inspection before close)** | Work goes to QA before DONE — Head inspects before ticket is marked resolved. Prevents premature closure. | Low | Standard CMMS have a binary open/closed. QA as a named status is uncommon; Incident IQ has an approval step but it is optional and not a first-class status column on a board. |

### Phase 2 Differentiators

| Feature | Value Proposition | Complexity | Competitive Gap |
|---------|-------------------|------------|-----------------|
| **Repeat repair detection** | System flags assets repaired 3+ times in 12 months. AI generates replace-vs-repair recommendation using cumulative cost vs. replacement cost. | High | FMX can show repair cost history per asset but has no automatic flagging or AI recommendation. No K-12 platform has AI replace-vs-repair. The drinking fountain example ($1,000+ repairs vs $400 replacement) is real and unsolved. |
| **QR code → ticket submission with pre-populated asset** | Teacher scans QR on broken equipment, asset and location auto-fill on new ticket. Sub-30 second submission path. | Medium | Incident IQ and FMX have QR scanning for asset lookup, but neither pre-populates a ticket submission form from the QR scan workflow. |
| **Loaded hourly rate labor costing** | Labor hours × loaded hourly rate = true cost per ticket. Enables cost-per-student and cost-per-building metrics. | Medium | FMX and Incident IQ track hours but few K-12 platforms apply loaded hourly rates automatically per technician. |
| **School calendar PM avoidance** | PM schedules can be flagged to avoid school-year dates, auto-shifting to breaks. Prevents disruption to instruction. | Medium | No K-12 CMMS found with explicit academic calendar integration for PM scheduling avoidance. This directly addresses K-12's unique constraint (can't do HVAC work during the school day). |
| **Receipt photo upload on cost entries** | Photo of receipt attached to ticket. Audit trail for every material purchase. | Low | FMX tracks costs; photo attachment on cost entries specifically is uncommon. |

### Phase 3 Differentiators

| Feature | Value Proposition | Complexity | Competitive Gap |
|---------|-------------------|------------|-----------------|
| **Full compliance calendar (10 regulatory domains)** | AHERA, NFPA, ADA, Lead in Water, Boiler, Elevator, Kitchen, Playground, Radon, IPM — all in one place with auto-generated work orders on failure. | Very High | This is the single largest gap in the market. SchoolDude/Brightly, FMX, and Incident IQ all have "partial" compliance. AHERA-specific software (Ecesis) exists as a standalone product. A fully integrated 10-domain compliance calendar in a K-12 CMMS would be a market first. |
| **FCI score with board-ready report** | Facility Condition Index auto-calculated from deferred maintenance cost and current replacement value. PDF report with AI narrative. Justifies capital budget requests to school board. | Very High | FMX has an FCI page (confirmed on gofmx.com/facility-condition-index/) but it is static documentation, not a live calculated score. Incident IQ has no FCI. SchoolDude has partial board reporting without FCI. Lionheart can be the first K-12 CMMS with a live, auto-calculated FCI fed from real ticket data. |
| **AI executive summary generation** | Claude Sonnet writes a plain-English narrative for the board report: "HVAC systems at Building A are approaching end-of-life; deferred maintenance grew 12% this quarter." | High | No K-12 CMMS has AI narrative generation. Generic CMMS platforms (MaintainX) have AI features but not board-report generation. |
| **True offline PWA** | Technician in a basement or at a remote field site submits tickets, completes PM checklists, logs labor — all sync when connection returns. | Very High | SchoolDude has no offline. Incident IQ has no offline. FMX has "partial" per spec competitive analysis. This is a real differentiator for campuses with poor Wi-Fi coverage. |
| **Knowledge base with embedded calculators** | Pond care dosage calculator, HVAC filter sizing — institutional knowledge captured and linked from PM checklists and AI diagnosis. Survives staff turnover. | High | No K-12 CMMS has embedded calculators in a knowledge base. Some platforms have document attachment (Incident IQ), but not structured knowledge articles with calculator widgets. |

---

## Anti-Features

Features to deliberately NOT build — either because they destroy value, distort the product direction, or are explicitly deferred in the spec.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Vendor portal for external contractors** | Requires separate auth system, invite flows, permission model, and communication threads. Adds months of complexity for a use case that affects <5% of tickets. | Track vendor name on cost entries. A vendor field on tickets is enough for Phase 1-3. Build a contractor portal post-launch if demand is validated. |
| **Parts inventory / ordering system** | Inventory management is a completely different domain (SKUs, stock levels, reorder points, POs). FMX has this and it is a full product sub-module. | Capture material cost + vendor on tickets. If a technician needs to track parts inventory, they keep using their existing parts system. Do not build a warehouse. |
| **SIS / student information system integration** | Auto-provisioning users from SIS requires OAuth integrations with dozens of vendors (Infinite Campus, Clever, PowerSchool). Each is a maintenance burden. | Use existing Lionheart user management. Onboard facilities staff manually. SSO integration is a platform-level concern, not maintenance module. |
| **Budget integration (Munis/Tyler)** | Financial system APIs are proprietary, require district IT involvement, and break on every software update. | Export CSV for finance staff to import. Board reports with cost data satisfy 90% of the budget reporting need without deep integration. |
| **State-specific compliance beyond federal** | OSHA regulations, state fire codes, and environmental regulations vary by state. Supporting all 50 states' variations requires a separate regulatory content team. | Build the 10 federal/universal domains in Phase 3. Expose a custom compliance domain builder so each org can add state-specific items manually. |
| **Complex approval chains on work orders** | Multi-step approvals (supervisor → director → CFO) add friction. Most K-12 facilities teams are 2-4 people. Over-engineered workflow = techs revert to email. | Head of Maintenance approval at QA → DONE is sufficient. The spec's status transitions already encode approval logic. |
| **Predictive maintenance via IoT sensors** | Requires hardware procurement, installation, network connectivity, and ongoing sensor data pipelines. Completely different product category. | Use PM schedules for time-based preventive maintenance. AI replace-vs-repair from ticket history is Phase 2's answer to failure prediction without IoT. |
| **Facility scheduling / event booking** | FMX combines facilities maintenance with event scheduling (room reservations). This is a separate product that creates UX confusion for maintenance techs. | Lionheart already has a calendar/events module. The availability note on maintenance tickets is the bridge. Do not merge maintenance and event scheduling. |
| **Fleet management** | FMX includes vehicle maintenance. Most K-12 facilities teams do not own a significant fleet. | If a vehicle needs maintenance, it can be created as an asset in the asset register. Full fleet management (driver logs, fuel tracking) is out of scope. |
| **Gamification / points / leaderboards** | Some enterprise CMMS platforms add technician points for completed tickets. In K-12 facilities, this creates resentment among union workers and distorts incentives. | Show technician productivity in analytics (tickets closed, hours logged) for management review only. Do not expose competitive metrics to individual technicians. |

---

## Feature Dependencies

Dependencies run downward — a feature requires all items above it to be built first.

```
Ticket Submission (Phase 1)
  └── Kanban Board (Phase 1)
       └── Activity Feed (Phase 1)
            └── Labor Hours Logging (Phase 2)
                 └── Analytics Dashboard (Phase 2)
                      └── Board-Ready FCI Report (Phase 3)

Asset Register (Phase 2)
  └── QR Code Tagging (Phase 2)
       └── Ticket pre-population from QR scan (Phase 2)

Asset Register (Phase 2)
  └── Repeat Repair Detection (Phase 2)
       └── Replace-vs-Repair AI Recommendation (Phase 2)
            └── FCI Score (Phase 3)

PM Schedule (Phase 2)
  └── PM Calendar View (Phase 2)
       └── Compliance Calendar (Phase 3)

AI Photo Diagnosis (Phase 1)
  └── AI Ticket Splitting (Phase 1)
       └── AI Replace-vs-Repair (Phase 2)
            └── AI Executive Summary (Phase 3)

TechnicianProfile model (Phase 1)
  └── Specialty Routing / Self-Claim (Phase 1)
       └── Technician Workload Metrics (Phase 2)
            └── Labor Cost per Technician (Phase 2)
```

---

## How Production Features Actually Work

Understanding the expected production behavior prevents under-building features or building them wrong.

### Kanban Board

Production K-12 CMMS boards (where they exist — Kanban is rare in this space) follow these behavioral rules:
- **Column WIP limits**: Not enforced by default. Columns can hold any number of cards. WIP limits are an optional configuration for power users.
- **Drag-and-drop validation**: Drop events must validate the status transition rules. Dropping a BACKLOG card into DONE must be rejected. The spec's transition table (section 3.2) maps directly to drop validation logic.
- **Card density**: Production boards show 20-40 cards per column before requiring scroll. Beyond 60 cards in a column, users demand column-level filtering or sub-grouping.
- **Filter persistence**: Users expect their selected filters (tech, priority, campus) to persist across page refreshes. Store in URL params or localStorage.
- **Real-time updates**: Production boards either poll every 30-60 seconds or use WebSocket/SSE. Full WebSocket infrastructure for a board this size is over-engineering. Polling with optimistic UI on drag is the correct approach.

### QR Code Asset Tagging

Production workflow in CMMS platforms:
1. Asset is created in the register → system generates a unique UUID-based URL (`/assets/[id]` or `/qr/[code]`)
2. QR code is generated as a downloadable PNG containing that URL
3. Physical QR label is printed and affixed to the equipment (typically laminated, often with the asset number printed below for redundancy)
4. Scanning opens a mobile-optimized asset detail page showing: open tickets, last maintenance, warranty, PM schedule
5. A prominent "Report Issue" button on the asset page pre-populates the ticket submission form with asset ID, location, and category

The critical production constraint: QR codes must resolve without authentication for submitters (teachers) who may not be logged in. The spec's `/api/assets/qr/:code` route handles this — it must be a public or lightly-authenticated endpoint.

### Preventive Maintenance Scheduling

Production PM systems work on a "next due date" cadence, not a calendar-event model:
- PM schedule stores `nextDueDate` + `recurrenceType` + `recurrenceInterval`
- A scheduled job runs daily and generates a ticket when `nextDueDate - advanceNoticeDays <= today`
- On ticket completion, `nextDueDate` is recalculated from `completedAt + recurrenceInterval` (not from `nextDueDate + interval`, which would drift)
- Missed PMs: if a PM ticket is not completed by `nextDueDate`, the system flags it as overdue (distinct from generating a new ticket)
- School calendar integration: `avoidSchoolYear` flag defers ticket generation until the next scheduled break period

The spec's PM model matches this correctly. The key implementation detail: the daily job must be idempotent — running it twice should not generate duplicate tickets.

### AI Photo Diagnostics

How this works in practice with an LLM API:
- **Lazy loading, not on submission**: AI analysis runs when a technician first opens the ticket with photos — not during submission. This keeps submission fast (sub-60 seconds) and avoids AI cost on tickets that never need diagnosis.
- **Caching is mandatory**: The spec's `aiAnalysis Json?` field on `MaintenanceTicket` is the cache. Once computed, the result is stored and never re-called unless photos change. Re-calling costs API money and frustrates users expecting the same result.
- **Confidence indicators**: Claude responds with diagnosis + confidence. LOW confidence should surface prominently ("AI is uncertain — verify on-site") rather than hiding it.
- **Structured output**: Prompt must request structured JSON output (diagnosis, tools needed, parts needed, steps[], confidence level, safety flags). Do not parse prose.
- **PPE surfacing**: The spec's Custodial/Biohazard PPE prompt is a special case — this should run from category selection alone, even without a photo, because it is a safety requirement, not a diagnostic feature.

### FCI Score

Production FCI calculation has three data requirements:
1. **Current Replacement Value (CRV)**: The `replacementCostUSD` on each Asset model. This must be populated for FCI to be meaningful. An empty asset register produces an FCI of 0%, which is misleading. Consider requiring `replacementCostUSD` when creating assets.
2. **Deferred Maintenance Cost**: The sum of estimated repair costs on open tickets in BACKLOG/TODO/IN_PROGRESS/ON_HOLD with no resolution path. The spec does not yet define a `estimatedRepairCostUSD` field on `MaintenanceTicket`. This is needed for FCI calculation.
3. **Capital Renewal Backlog**: Assets past expected lifespan with no replacement planned. Flags these for the board report.

The spec's FCI rating bands (0-5% Good, 5-10% Fair, 10-30% Poor, 30%+ Critical) match industry standard (confirmed via Gordian and FMX documentation).

### Compliance Calendar

How production compliance tracking works:
- Each regulatory domain (AHERA, NFPA 72, etc.) has a fixed inspection cycle (e.g., AHERA requires 3-year re-inspection + 6-month periodic surveillance)
- Admin configures which domains apply and provides initial baseline dates
- System auto-populates future deadlines based on those dates and the regulatory cycle
- 30-day and 7-day reminders generate in-app notifications and emails
- When an inspection is completed: pass → record is archived; fail → auto-generates a remediation `MaintenanceTicket` with URGENT priority
- All supporting documents (inspection reports, certificates, test results) attach to the compliance record
- Audit export: one-click PDF of all compliance records for a date range — this is the primary artifact for regulatory audits

AHERA specifically requires: 3-year re-inspections, 6-month periodic surveillance (visual), annual notification to parents/staff, O&M plan updates, accredited inspector certification. The system needs to track inspector credentials on compliance records for AHERA.

### Repeat Repair Detection

Production behavior:
- Triggered on every ticket close (DONE status)
- Query: count tickets against same `assetId` where `resolvedAt >= now - 12 months`
- If count >= 3: flag asset, send email to Head of Maintenance, surface banner on asset detail page
- AI recommendation is generated lazily (on next Head of Maintenance view of the asset), not synchronously on close
- Replace-vs-repair threshold: `(cumulative repair costs / replacementCostUSD) >= repairThresholdPct` (default 0.5 = 50%)
- Edge case: the same ticket re-opened and re-closed multiple times should not count as multiple repairs. Count distinct `closedAt` dates or use `MaintenanceTicket.id` as the unit.

---

## MVP Recommendation

**Prioritize in Phase 1 (must ship for users to leave SchoolDude):**

1. Mobile-first ticket submission with location picker and photo upload
2. 8-status Kanban board with drag-and-drop — this is the visual centerpiece, it is the reason users leave SchoolDude
3. AI photo diagnosis (Claude Sonnet, lazy-loaded, cached) — this is the "wow" moment in demos and trials
4. Specialty routing + self-claim
5. Email notifications for full ticket lifecycle
6. Activity feed with internal comments
7. SCHEDULED status (solves Linfield's inflated backlog pain directly)
8. Head of Maintenance dashboard

**Defer within Phase 1 (these can slip to Phase 2 without killing adoption):**

- AI ticket splitting: High value but lower urgency. Manual ticket splitting with a split UI is acceptable in MVP.
- PPE prompts: Important for compliance but does not block initial adoption.
- Voice-to-text on description field: Nice mobile UX; browser's native speech-to-text handles this for free without custom implementation.

**Phase 2 must include (or Phase 3 will not land):**

Asset register is the prerequisite for everything in Phase 3. FCI scoring requires `replacementCostUSD` data on assets. Compliance tickets link to assets. If asset data is not populated during Phase 2, Phase 3 reports will be empty. Consider making `replacementCostUSD` a required field during asset creation with an estimated value helper.

**The Phase 3 compliance calendar is the product's long-term moat.** No K-12 CMMS has fully automated compliance across 10 domains. Completing Phase 3 creates a defensible position that SchoolDude/Brightly, FMX, and Incident IQ would take 12-18 months to replicate.

---

## Sources

- [Incident IQ K-12 Facilities Management Features](https://www.incidentiq.com/products/school-facilities-management-software) — MEDIUM confidence (marketing page, first-party)
- [FMX School Facilities Management Software](https://www.gofmx.com/school-facilities-management-software/) — MEDIUM confidence (marketing page, first-party)
- [FMX Facility Condition Index](https://www.gofmx.com/facility-condition-index/) — HIGH confidence (confirms FCI is static content, not live score)
- [Best School Facilities Management Software (SoftwareConnect)](https://softwareconnect.com/roundups/best-school-facilities-management-software/) — MEDIUM confidence (third-party review site)
- [QR Code Asset Tagging CMMS Guide (Fabrico 2025)](https://www.fabrico.io/blog/qr-codes-for-maintenance-guide/) — HIGH confidence (practitioner guide with production workflows)
- [Gordian: Understanding Facility Condition Index](https://www.gordian.com/resources/understanding-facility-condition-index/) — HIGH confidence (industry authority on FCI)
- [Ecesis AHERA Compliance Calendar Software](https://www.ecesis.net/Compliance-Calendar-Software/AHERA-compliance-calendar-software.aspx) — HIGH confidence (confirms AHERA-specific standalone software exists; validates Lionheart's compliance calendar as differentiator)
- [10 Crucial Facility Management Challenges in K-12 Schools (ARC Facilities)](https://www.arcfacilities.com/blog/crucial-facility-management-challenges-in-k12-schools-and-how-to-solve-them) — MEDIUM confidence (practitioner blog)
- [CMMS Implementation Mistakes (EngMaintSolutions)](https://www.engineeringmaintenance.info/editorial/cmms-asset-management-software/avoiding-the-pitfalls-common-cmms-implementation-mistakes-and-how-to-prevent-them) — MEDIUM confidence (practitioner analysis)
- [Lean Facility Management: Kanban System](https://leanconstructionblog.com/Lean-facility-management%E2%80%93Introduction-of-Kanban-system.html) — MEDIUM confidence (confirms Kanban as emerging, not standard in FM)
- [FTMaintenance: Repair vs. Replace with CMMS](https://ftmaintenance.com/maintenance-management/making-repair-vs-replace-decisions-with-cmms/) — MEDIUM confidence (confirms no K-12 platform has AI replace-vs-repair)
- [MaintainX AI-Powered Operations](https://www.getmaintainx.com/use-cases/ai-powered-maintenance-operations) — LOW confidence (marketing page; AI claims not independently verified)
- Linfield facilities team meeting notes (Feb 12, 2026) — HIGH confidence (primary source, first-party pain points)
