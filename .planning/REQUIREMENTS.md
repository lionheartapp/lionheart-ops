# Requirements: Lionheart v3.0 — Events Are the Product

**Defined:** 2026-03-14
**Core Value:** Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.

## v3.0 Requirements

### Event Foundation

- [x] **EVNT-01**: Staff can create an EventProject from an approved planning season submission
- [x] **EVNT-02**: Staff can create a recurring EventSeries with default schedule, location, and resource needs
- [x] **EVNT-03**: Staff can submit a direct event request (mid-year) for admin approval that becomes an EventProject
- [x] **EVNT-04**: Staff can view an EventProject page with 8 tabbed sections (Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms)
- [x] **EVNT-05**: Staff can build a multi-day event schedule with time blocks (session, activity, meal, free time, travel, setup)
- [x] **EVNT-06**: Staff can create and manage tasks within an event (assignee, due date, priority, status, category)
- [x] **EVNT-07**: System automatically logs all changes and milestones on an event activity log
- [x] **EVNT-08**: Calendar view reads from EventProject data via a CalendarEvent bridge (sourceModule='event-project')
- [x] **EVNT-09**: Sidebar navigation shows Events as primary item with Calendar and Planning nested under it
- [x] **EVNT-10**: Dashboard shows AI-prioritized action items across all active events with one-tap resolution

### Registration & Forms

- [x] **REG-01**: Staff can configure a registration form with toggleable common fields (name, grade, emergency contacts, dietary, allergies, medications, t-shirt size, etc.)
- [x] **REG-02**: Staff can add custom form fields (text, dropdown, checkbox, number, date, file upload) with label, help text, and required toggle
- [x] **REG-03**: Staff can organize form fields into named sections that become pages in the parent-facing form with a progress indicator
- [x] **REG-04**: Parents can register for an event on a public page branded with school logo and cover image (zero Lionheart branding)
- [x] **REG-05**: Parents can pay event fees via Stripe (credit card, Apple Pay, Google Pay) with deposit, payment plan, and discount code options
- [x] **REG-06**: Parents can sign required documents (permission slips, waivers, medical releases) with finger on mobile or typed name on desktop
- [x] **REG-07**: Parents receive a confirmation email with event details and a unique QR code after registration
- [x] **REG-08**: Parents can access their registration portal via magic link (no Lionheart account needed) to view schedule, groups, announcements, and outstanding documents
- [x] **REG-09**: Staff can publish an event via a Share hub with link copy, QR code for flyers, email distribution, branding controls, and registration open/close dates
- [x] **REG-10**: System manages registration capacity with automatic waitlist promotion when spots open
- [x] **REG-11**: Parents can upload a student photo during registration that appears on rosters, check-in screens, and printed materials
- [x] **REG-12**: Public registration forms are protected by CAPTCHA (Cloudflare Turnstile) and rate limiting
- [x] **REG-13**: Medical and emergency contact data is stored in a separate table with distinct permission (events:medical:read) for FERPA/COPPA compliance

### Documents & Signatures

- [x] **DOC-01**: Staff can define required documents per event (permission slip, waiver, medical release, photo release, custom)
- [x] **DOC-02**: Staff can view per-participant document completion status and send targeted reminders to incomplete families
- [x] **DOC-03**: Staff can manage a compliance checklist for off-campus events (insurance certificates, vendor contracts, background checks)

### Groups & Logistics

- [x] **GRP-01**: Staff can create groups by type (bus, cabin, small group, activity) with name, capacity, and assigned leader
- [x] **GRP-02**: Staff can assign participants to groups via drag-and-drop interface
- [x] **GRP-03**: Staff can generate printable PDFs: bus manifests (with medical flags), cabin rosters (with photos), medical summaries, emergency contact sheets, activity rosters, check-in sheets
- [x] **GRP-04**: Staff can manage elective activity signups with real-time capacity tracking
- [x] **GRP-05**: Staff can view aggregated dietary and medical reports from registration data
- [x] **GRP-06**: Parents can see their student's group assignments on the participant dashboard

### QR & Day-Of Operations

- [x] **QR-01**: Staff can scan participant QR codes for check-in with a real-time counter showing checked-in vs. total
- [x] **QR-02**: Authorized staff can scan a QR code to view participant info (name, photo, groups, medical flags based on role permissions)
- [x] **QR-03**: Participants can scan their QR code to view personal schedule, group assignments, and event announcements
- [x] **QR-04**: Day-of tools (QR scanning, rosters, headcount, incident logging) work offline via PWA with automatic sync on reconnect
- [x] **QR-05**: Staff can log incidents during events (medical, behavioral) with involved participants, actions taken, and follow-up needs

### Budget & Financials

- [x] **BUD-01**: Staff can create a line-item budget with categories (venue, transportation, food, supplies, insurance) and budgeted amounts
- [x] **BUD-02**: Staff can log actual expenses with receipt uploads and track revenue (registration fees, sponsorships, fundraising)
- [x] **BUD-03**: Staff can view budget vs. actual reporting with per-participant cost analysis

### Communication

- [x] **COM-01**: Staff can post targeted announcements to specific audiences (all registrants, specific group, incomplete-docs families, paid-only)
- [x] **COM-02**: Parents see announcements on the public event page and participant dashboard in real time
- [x] **COM-03**: Staff can set up an automated notification timeline with date-based and condition-based triggers with AI-drafted messages
- [x] **COM-04**: Staff can collect post-event feedback via surveys at the registration URL
- [x] **COM-05**: Multiple staff can collaborate on an event project with real-time updates and presence indicators

### AI Features

- [x] **AI-01**: Staff can create an event from a natural language description (auto-fills details, required docs, starter task list, budget range)
- [ ] **AI-02**: AI generates a registration form based on event type and parameters
- [ ] **AI-03**: AI generates initial group assignments based on constraints (gender, grade, friend requests, counselor ratios)
- [ ] **AI-04**: AI detects scheduling conflicts beyond date/room overlap (weather risk, testing schedules, audience overlap)
- [x] **AI-05**: AI generates multi-day event schedules from a natural language description
- [x] **AI-06**: AI estimates budgets based on historical event data and current event parameters
- [ ] **AI-07**: AI drafts communication messages with full event context
- [x] **AI-08**: AI generates status summaries on the event Overview
- [ ] **AI-09**: AI analyzes post-event feedback surveys and surfaces actionable themes
- [x] **AI-10**: Staff can save any event as a template and create new events from templates
- [x] **AI-11**: AI enhances templates by auto-updating dates, adjusting budgets, and surfacing lessons learned

### External Integrations

- [ ] **INT-01**: Staff can sync worship sets, team assignments, and people data with Planning Center
- [ ] **INT-02**: Staff can sync events to Google Calendar
- [ ] **INT-03**: System can send SMS notifications via Twilio for day-of updates and deadline reminders

## Future Requirements (v3.1+)

- **DEFER-01**: Conditional form logic (branching, calculated fields)
- **DEFER-02**: DocuSign/HelloSign legal e-signature integration
- **DEFER-03**: Native iOS/Android app
- **DEFER-04**: SIS integration (PowerSchool, Clever, Infinite Campus)
- **DEFER-05**: Budget integration with financial systems (Munis/Tyler)
- **DEFER-06**: Complex multi-step approval workflows
- **DEFER-07**: Public event discovery / school-wide event calendar
- **DEFER-08**: Participant-to-participant social features
- **DEFER-09**: Automated payment reconciliation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Conditional form logic | Exponential complexity — Jotform embed covers edge cases |
| DocuSign/HelloSign | Built-in signatures handle 95% of school waivers |
| Native mobile app | PWA achieves 90% of native experience without App Store overhead |
| Video streaming | Different infrastructure — embed YouTube/Zoom links |
| SIS integration | Each SIS has different OAuth; CSV import sufficient for v3.0 |
| Multi-step approvals | Single admin gate covers 95% of schools |
| Participant social features | COPPA risk for under-13; group announcements suffice |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVNT-01 | Phase 19 | Complete |
| EVNT-02 | Phase 19 | Complete |
| EVNT-03 | Phase 19 | Complete |
| EVNT-04 | Phase 19 | Complete |
| EVNT-05 | Phase 19 | Complete |
| EVNT-06 | Phase 19 | Complete |
| EVNT-07 | Phase 19 | Complete |
| EVNT-08 | Phase 19 | Complete |
| EVNT-09 | Phase 19 | Complete |
| EVNT-10 | Phase 19 | Complete |
| REG-01 | Phase 20 | Complete |
| REG-02 | Phase 20 | Complete |
| REG-03 | Phase 20 | Complete |
| REG-04 | Phase 20 | Complete |
| REG-05 | Phase 20 | Complete |
| REG-06 | Phase 20 | Complete |
| REG-07 | Phase 20 | Complete |
| REG-08 | Phase 20 | Complete |
| REG-09 | Phase 20 | Complete |
| REG-10 | Phase 20 | Complete |
| REG-11 | Phase 20 | Complete |
| REG-12 | Phase 20 | Complete |
| REG-13 | Phase 20 | Complete |
| DOC-01 | Phase 21 | Complete |
| DOC-02 | Phase 21 | Complete |
| DOC-03 | Phase 21 | Complete |
| GRP-01 | Phase 21 | Complete |
| GRP-02 | Phase 21 | Complete |
| GRP-03 | Phase 21 | Complete |
| GRP-04 | Phase 21 | Complete |
| GRP-05 | Phase 21 | Complete |
| GRP-06 | Phase 21 | Complete |
| QR-01 | Phase 21 | Complete |
| QR-02 | Phase 21 | Complete |
| QR-03 | Phase 21 | Complete |
| QR-04 | Phase 21 | Complete |
| QR-05 | Phase 21 | Complete |
| COM-01 | Phase 21 | Complete |
| COM-02 | Phase 21 | Complete |
| COM-03 | Phase 22 | Complete |
| COM-04 | Phase 21 | Complete |
| COM-05 | Phase 21 | Complete |
| BUD-01 | Phase 22 | Complete |
| BUD-02 | Phase 22 | Complete |
| BUD-03 | Phase 22 | Complete |
| AI-01 | Phase 22 | Complete |
| AI-02 | Phase 22 | Pending |
| AI-03 | Phase 22 | Pending |
| AI-04 | Phase 22 | Pending |
| AI-05 | Phase 22 | Complete |
| AI-06 | Phase 22 | Complete |
| AI-07 | Phase 22 | Pending |
| AI-08 | Phase 22 | Complete |
| AI-09 | Phase 22 | Pending |
| AI-10 | Phase 22 | Complete |
| AI-11 | Phase 22 | Complete |
| INT-01 | Phase 22 | Pending |
| INT-02 | Phase 22 | Pending |
| INT-03 | Phase 22 | Pending |

**Coverage:**
- v3.0 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 — traceability populated after roadmap creation*
