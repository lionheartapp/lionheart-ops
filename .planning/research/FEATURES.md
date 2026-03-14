# Feature Research: K-12 School Event Planning System

**Domain:** K-12 Educational Event Planning Platform (v3.0 — Events Are the Product)
**Project:** Lionheart — EventProject milestone layered onto existing Calendar/Events/Planning modules
**Researched:** 2026-03-14
**Confidence:** HIGH

---

## Context

This research covers the v3.0 milestone only. The existing platform already has:
- `CalendarEvent` model with approval workflow, resource requests, attendees, recurring events (RRULE)
- `PlanningSeason` → `PlanningSubmission` → approval pipeline (the "war room" flow)
- `Event` and `DraftEvent` legacy models (org-scoped, soft-delete)
- In-app notification system, Resend email, Gemini AI, Supabase Storage
- QR codes on maintenance assets (pattern already understood in the codebase)
- Offline PWA already implemented for the Maintenance module (Serwist + Dexie)

The new `EventProject` model is a hub that wraps/extends a `CalendarEvent` — it does not replace it. The calendar continues to read from `CalendarEvent`. The EventProject adds registration, forms, documents, groups, budget, comms, and day-of tooling on top.

---

## Table Stakes

Features users (event planners, administrators, parents) assume exist. Missing these = product does not pass evaluation.

### Staff-Side Planning (Internal)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| EventProject hub page with tabbed sections | Staff expect a single workspace per event; jumping between disconnected screens is unacceptable for week-long camp planning | MEDIUM | Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms — empty sections serve as built-in checklist. Already validated in PROJECT.md as the "show everything" design. |
| Three entry paths to EventProject | Planning Season approval, recurring series, direct mid-year request. All three exist as user mental models that must map to workflows. | HIGH | Path 1 wires PlanningSeason approval → EventProject creation. Path 2 is new EventSeries model. Path 3 is a lightweight standalone request. The CalendarEvent backbone is shared across all three. |
| Event activity log (automatic) | Multiple people planning simultaneously need a history: who did what, when. Becomes institutional memory for templates. | LOW | Server-side, auto-generated on every mutation. Lightweight append-only table. Same pattern as MaintenanceTicket activity logging. |
| Navigation reorientation (Events primary) | Events as organizing principle means Calendar/Planning nested under Events in sidebar. Current flat list structure contradicts the vision. | LOW | Sidebar restructure only — no new data models. Calendar and Planning remain fully functional, just nested. |
| Task checklist per event | Planners need "get the permission slips back" as a trackable to-do, not just a reminder. | LOW | Simple `EventTask` model with assignee, due date, status. Not project management software — just a checklist. |

### Registration & Forms (Public-Facing)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public event page with school branding | Parents register at a URL that looks like the school, not like "Lionheart." Logo, cover image, event details — zero Lionheart branding visible to parents. Confirmed as standard expectation across Sched, Planning Pod, RSVPify, Aryval. | MEDIUM | Pulls from existing `/api/branding` endpoint. Split-panel desktop, mobile-first form layout. This is the first public-facing page in Lionheart — new security surface. |
| Registration form with common fields | Student name, grade, emergency contacts, dietary restrictions, allergies, medications, t-shirt size — these appear in every camp and field trip form. Planners expect to toggle them on/off, not rebuild them from scratch. | MEDIUM | Common fields as toggleable presets. No custom logic needed for common fields — they just map to known `EventRegistration` columns. Confirmed across CampDoc, CampBrain, jumbula, Regpacks. |
| Custom form fields | Text, dropdown, checkbox, number, date, file upload. Label + help text + required/optional toggle. | MEDIUM | No conditional logic (branching, calculated fields) — explicitly out of scope per PROJECT.md. Simple field definition stored as JSON on the EventForm model. |
| Multi-page form with progress indicator | Camps have 4-6 pages: Student Info, Medical, Preferences, Payment, Signatures. Single-page forms are overwhelming. Progress bar/page count is expected. | MEDIUM | Page = section. Planner names sections and reorders them. Progress indicator ("Page 2 of 5") in parent-facing form. Confirmed across multiple camp registration platforms. |
| Payment collection via Stripe | Camp fees, deposits, payment plans. Parents expect credit card, Apple Pay, Google Pay. Stripe Elements is PCI-compliant and correct — card data never touches Lionheart servers. | HIGH | Stripe Elements only. Deposit option (partial payment), payment plans (installment schedules), discount codes. Balance tracking per registration. Confirmed as 98% importance rating in Regpacks/Jumbula research. |
| E-signature capture | Permission slips, liability waivers, medical releases, photo releases. Finger on mobile, typed name on desktop. Timestamp + IP recorded. | MEDIUM | Not DocuSign-level — "type your name and check the box" is legally sufficient for school waivers. Signature text + timestamp + IP stored per document per registrant. Confirmed as standard approach across school registration platforms. |
| Confirmation email with QR code | After registration, parent expects an immediate confirmation email containing the event details and a QR code for the student. | LOW | Extends existing Resend email service. QR code is the registration ID encoded. Uses existing `qrcode.react` pattern from maintenance assets. |
| Magic link / code access for parents | Parents should not need to create a Lionheart account. They click a link from email and land directly in their registration portal. | MEDIUM | Time-limited token (15-30 min) in the initial email, but the participant dashboard requires a persistent session. Use a session token stored in a secure cookie tied to the registration ID. Token refresh on each visit. Best practice confirmed via magic link research. |
| Registration capacity + waitlist | Planners set a max capacity. When full, latecomers go on a waitlist with automatic promotion when a spot opens. | LOW | Capacity on `EventRegistration` or the EventProject itself. Waitlist as a queue with `position` field. Auto-promote on cancellation. |
| Share/distribution hub | Copy link, generate QR code for flyers, email to parent list. Preview the public page before publishing. Confirmed as standard in Planning Pod, RSVPify. | MEDIUM | "Share" button opens a publishing control center panel. Not just a URL copy. Includes branding controls, registration open/close dates, capacity limit. |

### Documents & Signatures

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document completion tracking per participant | Planners need to see exactly which 14 families haven't signed the medical release, not just a total count. | MEDIUM | Per-registration document status. Targeted reminder to incomplete families. Confirmed as core expectation in vision doc's Big Bear scenario. |
| Compliance checklist for off-campus events | Insurance certificates, bus company docs, background checks for chaperones — these are not personal signatures but institutional documents the planner uploads. | LOW | Compliance checklist items on the EventProject. Admin uploads file, marks item complete. Simple boolean/file attach pattern. |

### QR Code System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| QR check-in with real-time count | At arrival, staff scan codes and the "X of Y checked in" counter updates live. Missing students are immediately visible by name. | MEDIUM | QR scanning uses existing `html5-qrcode` or Barcode Detection API in PWA. Check-in status is a field on `EventRegistration`. Real-time count via SSE or polling. Confirmed across Aryval, Raptor EventSafe, Planning Pod. |
| QR code shows participant info to authorized staff | Scan a student's QR → see name, photo (if uploaded), group assignments, medical flags. Medical access is permission-gated. | MEDIUM | The scan resolves to the registration record. What you see depends on your role (check-in staff vs. nurse vs. cabin leader). |

### Group Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Group creation (buses, cabins, small groups) | Any camp or field trip with 20+ people needs groups. This is a universal expectation in camp management software. | LOW | `EventGroup` model with type (BUS, CABIN, SMALL_GROUP, ACTIVITY). Simple name + capacity + group type. |
| Drag-and-drop group assignment | Manual assignment of 120 students to cabins is a whiteboard exercise. Software must make it visual and interactive. | HIGH | Confirmed as the critical UX expectation in CampMinder, iCampPro, CampBrain's "Cabinizer," CampSite's "Bunking Board." dnd-kit is already installed for the maintenance Kanban. |
| Printable rosters (bus manifests, cabin lists, medical summaries) | The bus driver needs a printed manifest. Cabin leaders get posted rosters. The nurse gets a medical summary. These are safety documents, not convenience features. | MEDIUM | Confirmed in vision doc and validated by every camp management platform researched. @react-pdf/renderer already installed. |

### Budget

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Budget line items with revenue/expense tracking | Planners track deposits collected vs. venue cost vs. bus cost. They need actual vs. budgeted at the line-item level. | MEDIUM | `EventBudgetLine` model with category, budgeted amount, actual amount, type (INCOME/EXPENSE). Simple spreadsheet-like view. Not a full accounting system. |

### Communication

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Targeted announcements to registered participants | "Bus 2 is running late" sent to Bus 2 parents only. "Waiver deadline is tomorrow" sent to incomplete families only. Audience targeting is a core expectation. | MEDIUM | `EventCommunication` model with audience filter (all, group, incomplete-docs, paid-only). Delivered via email + in-app notification for logged-in staff. Parents receive email. |
| Post-event feedback survey | After the event, participants/parents get a survey link. Results are visible to the planner. | LOW | Simple form builder reuse (subset of registration form). No complex survey logic needed. |

---

## Differentiators

Features that set Lionheart apart from generic form builders (Jotform, Google Forms) and standalone event platforms (Planning Center, Eventbrite). These are the reasons a school chooses Lionheart over stitching together separate tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| EventProject as unified workspace | Every other solution requires a separate tool for registration (Jotform), another for budget (spreadsheet), another for communication (Mailchimp). Lionheart puts it all in one event-branded workspace. The "wow" is that a week-long camp's entire lifecycle — proposal to post-event debrief — lives in one place. | HIGH | This is the core architectural differentiator. All sections share the same EventProject context. A budget line can reference a group. A communication can target families with outstanding documents. The connections only exist when everything is in one system. |
| Participant QR code as identity for the entire event | Most platforms issue a QR for check-in only. Lionheart's QR is the student's event identity: check-in, cabin assignment display, activity signups, medical access, parent visibility. One code, everything. | HIGH | Technically simple (UUID lookup) but experientially transformative. The Big Bear scenario (cabin assignment posted instantly on phone, nurse sees medical info from scan) is something no generic event platform offers K-12 schools. |
| AI-powered event creation from natural language | "Field trip to Griffith Observatory, 45 juniors, March 12th" → pre-filled event, required docs auto-added, starter task list, budget range suggestion. Eliminates the blank page for first-time planners. | HIGH | Builds on existing Gemini integration. Context-aware: uses org's historical event data for budget estimates, knows school's document templates. |
| AI form generation | "Week-long off-campus camp, high schoolers, $350 fee" → complete multi-page registration form generated. Planner reviews and publishes instead of building from scratch. | HIGH | Unique in the K-12 event space. No competitor (Planning Center, Sched, RSVPify) has AI form generation. |
| AI group assignments | 120 students, gender + grade + friend requests + counselor ratios → initial cabin assignments generated. Planner tweaks instead of doing it on a whiteboard. | HIGH | Confirmed in iCampPro as drag-and-drop only (no AI). CampMinder's "bunk assignment" is manual with conflict warnings. Lionheart's AI-first then human-adjust approach is a market gap. |
| Notification orchestration with condition-based triggers | Set up the entire communication sequence during planning: "when registration hits 80%, send 'spots filling up'"; "3 days before waiver deadline, remind incomplete families." Runs automatically, coordinator approves before each send. | HIGH | School platforms research found basic email reminders but no condition-based orchestration. This eliminates the "I forgot to send the reminder" failure mode that every event planner has experienced. |
| AI-enhanced templates with lessons learned | Save an event as template. Next year's planner opens it and AI has already updated dates, adjusted budget for inflation, flagged departed vendors, and surfaced lessons from last year's feedback. Institutional knowledge survives staff turnover. | HIGH | Template systems exist in camp management software. None surface lessons learned with AI analysis. This creates a compounding flywheel — every event makes future events better. |
| Participant personal dashboard (no account needed) | After registration, the same URL used to register becomes the participant's live portal: their schedule, their group assignments, announcements in real time, outstanding documents to sign. No app download, no account creation. | HIGH | Magic link access to a personalized event view is not available in any K-12 school event platform found in research. Most platforms lock this behind account creation. |
| Intelligent conflict detection | Goes beyond "that room is booked" to: weather risk for outdoor events, SAT weekend audience overlap, three events in the same week targeting the same grade level. Proactive scheduling intelligence, not just reactive blockers. | HIGH | No K-12 event platform found with AI-driven conflict analysis beyond basic date/room overlap. |
| Real-time collaboration with presence indicators | Five people planning the same event simultaneously — youth pastor on schedule, worship leader on sessions, logistics coordinator on cabins. They see each other's changes live without page reload. | HIGH | Confirmation emails, instant roster updates, and presence indicators distinguish Lionheart from any school-specific tool where "collaboration" means "share a spreadsheet." |
| Offline-capable day-of tools (PWA) | Cabin leaders in the mountains with no cell service can still do headcount, view rosters, log incidents. Syncs when connectivity returns. | HIGH | Already implemented for Maintenance module (Serwist + Dexie pattern). Applying it to event check-in/headcount is an extension of existing architecture. No K-12 event platform found with offline day-of capability. |
| Dietary and medical aggregation reports | "8 vegetarian, 3 gluten-free, 2 nut allergies across 120 students" — one report to the camp kitchen. "All students with any medical flag" — one report for the nurse's binder. Aggregated from registration data, formatted for non-Lionheart recipients. | MEDIUM | CampDoc does medical aggregation as its core product. Lionheart integrates it into the same workspace as the event logistics. Having it in context (alongside groups, schedule, budget) adds value CampDoc cannot. |
| Budget vs. actual with per-participant cost analysis | "This camp cost $287 per student, down from $310 last year." Actual expenses logged against budgeted line items. Revenue from registration fees tracked. Per-participant cost calculated automatically. | MEDIUM | Spreadsheet-level capability embedded in the event workspace. Generic event platforms do not calculate per-participant cost. |
| Photo upload with safety benefits | Student photo on registration appears on check-in screens, cabin rosters, medical summaries. Visual confirmation that the QR code holder is who they say they are. Camp nurse identifies a distressed student by photo, not name. | MEDIUM | CampDoc emphasizes photos for medical identification. Lionheart's integration of photos across all day-of tools (check-in, rosters, medical) is stronger than standalone camp platforms. |

---

## Anti-Features

Features to explicitly not build, with documented rationale to prevent scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Conditional form logic (branching, calculated fields) | "Show the bus assignment page only if the student is riding the bus" — seems useful | Exponential complexity. Branching + calculated fields = Jotform. Building it correctly requires a visual form logic builder, testing infrastructure, and edge-case handling that would absorb an entire phase. The 95% use case (camps, field trips) has no branching needs. | Use the multi-page form for section organization. Complex forms (medical questionnaires with branching) can embed a Jotform/Google Forms link as a custom field. Out of scope per PROJECT.md. |
| DocuSign/HelloSign integration | "We need legally binding e-signatures for contracts" | Different product category (legal e-signature vs. school permission slips). DocuSign APIs require agreement management, certificate of completion, audit trails beyond what Lionheart needs. 95% of school waivers are adequately served by "type your name + timestamp + IP." | Built-in signature capture handles all standard school documents. If a school needs notarized signatures, that's DocuSign — integrate as a future add-on, not Phase 1. Out of scope per PROJECT.md. |
| Video streaming within events | "Stream the spring concert for parents who can't attend" | Storage costs, CDN costs, encoding complexity, latency management — completely different infrastructure. Lionheart is not a video platform. | Embed a YouTube/Zoom link as a custom field or announcement. External service. Out of scope per PROJECT.md. |
| Native iOS/Android app | "Parents want a proper app for notifications" | App Store approval cycles, separate Android/iOS codebases, push notification infrastructure, per-device testing. PWA achieves 90% of the native app experience without any of this overhead. No App Store gatekeeping for school deployments. | PWA with Add to Home Screen. Push notifications via Web Push API (already in service worker). Out of scope per PROJECT.md. |
| SIS integration (PowerSchool, Infinite Campus, Clever) | "Automatically pull student rosters for registration" | Every SIS has a different OAuth implementation. Each is a maintenance burden. When the SIS updates their API, Lionheart breaks. | Staff manually create events and parents register themselves. For large-scale district deployments, CSV import of student list is sufficient. Deferred to post-v3 decision per PROJECT.md. |
| Budget integration with Munis/Tyler | "Push event expenses directly to the financial system" | Proprietary APIs, district IT involvement, breaks on every vendor update. Same problem as SIS integration. | Planner exports budget report as PDF/CSV. Finance staff imports manually. Board report with cost data satisfies 90% of the need. Out of scope per PROJECT.md. |
| Complex multi-channel approval workflows | "The budget must go to department head, then VP, then CFO" | Multi-step configurable approvals require a workflow engine, not a feature. Schools with 2-4 people in the events team have one admin who approves things. Over-engineering reverts staff to email. | Single admin approval gate on the planning submission. Budget review is a section in the EventProject that anyone can comment on. Sequential approvals are a post-MVP feature for enterprise district customers. |
| Public event discovery / school-wide event calendar | "Parents want to browse all upcoming school events in one place" | Requires a public directory with event listings, search, filtering — a different product surface than the event project page. Also has significant privacy implications (not all school events should be publicly discoverable). | Each event has its own public URL. The school controls distribution via the Share/Distribution Hub. No centralized public listing in v3.0. |
| Full attendee social features (profiles, DMs, networking) | "Let students connect with their cabin mates before camp" | Social platform features are a completely different product. COPPA compliance for minors under 13 prohibits many social features. | Group announcements and schedule sharing satisfy the pre-event communication need. Direct participant-to-participant messaging is out of scope. |
| Automated payment reconciliation | "Match Stripe payouts to event line items automatically" | Bank reconciliation and payout matching require accounting-level logic. Stripe payout schedules don't align 1:1 with individual events. | Stripe Dashboard handles reconciliation. Lionheart reports registration payment totals per event. Finance team does final reconciliation externally. |

---

## Feature Dependencies

Dependencies run downward — a feature requires all items above it to exist first.

```
CalendarEvent (existing)
  └──wraps──> EventProject (hub model — Phase 1)
               ├── Activity Log (Phase 1)
               ├── Navigation Reorientation (Phase 1)
               ├── EventTask checklist (Phase 1)
               │
               ├──requires──> Registration Form Builder (Phase 2)
               │               └──requires──> Public Event Page (Phase 2)
               │                               ├── Magic Link Auth (Phase 2)
               │                               ├── Stripe Payment (Phase 2)
               │                               └── E-Signature Capture (Phase 2)
               │
               ├──requires──> EventRegistration model (Phase 2)
               │               ├── QR Code per Registration (Phase 2)
               │               ├── Check-In QR Scanning (Phase 3)
               │               ├── Participant Dashboard (Phase 2)
               │               └── Document Completion Tracking (Phase 2)
               │
               ├──requires──> EventGroup model (Phase 3)
               │               ├── Drag-and-Drop Assignment UI (Phase 3)
               │               ├── Printable Rosters (Phase 3)
               │               └── AI Group Assignment (Phase 4)
               │
               ├──requires──> EventBudgetLine model (Phase 4)
               │               └── Budget vs. Actual Report (Phase 4)
               │
               ├──requires──> EventCommunication model (Phase 3)
               │               ├── Targeted Announcements (Phase 3)
               │               └── Notification Orchestration (Phase 4)
               │
               ├──enhances via──> AI (Phase 4+)
               │   ├── Smart Event Creation (requires EventProject Phase 1)
               │   ├── AI Form Generation (requires Form Builder Phase 2)
               │   ├── AI Group Assignment (requires EventGroup Phase 3)
               │   ├── Notification Drafting (requires EventCommunication Phase 3)
               │   └── Template Intelligence (requires Save-as-Template)
               │
               └──requires for offline──> PWA Day-Of Tools (Phase 3)
                   ├── Offline QR Scanning (requires Check-In Phase 3)
                   ├── Offline Rosters (requires EventGroup Phase 3)
                   └── Offline Incident Log (requires EventProject Phase 1)

PlanningSeason (existing)
  └──publishes as──> EventProject (Phase 1)
                      [bridges existing approval → new workspace]

EventSeries (new, Phase 1)
  └──generates──> EventProject instances
                   [recurring series management]
```

### Dependency Notes

- **EventProject requires CalendarEvent:** The EventProject is a hub that wraps a CalendarEvent (or creates one). The calendar continues to read from `CalendarEvent`. EventProject never replaces CalendarEvent — it enriches it. This means the CalendarEvent schema must be extended before EventProject is built.

- **Registration requires EventProject:** The form builder, public page, and `EventRegistration` model all attach to an EventProject. Building registration before the EventProject hub model is complete would create an orphaned system.

- **QR check-in requires EventRegistration:** The QR code is generated from the registration record. Check-in sets a flag on `EventRegistration`. There is no QR without registration.

- **Group assignment requires EventRegistration:** You cannot assign students to groups until you know who registered. Drag-and-drop assignment is meaningless without a participant list populated from registration.

- **AI features require their non-AI counterparts:** AI form generation requires the form builder to exist (it generates fields in the same format). AI group assignment requires EventGroup to exist. AI features are always the second layer — the human-first version ships first, then AI enhances it.

- **Offline PWA requires stable data models:** PWA caching and sync strategies depend on knowing what data to cache. Phase 3 is the right timing — after EventRegistration, EventGroup, and EventCommunication models are stable.

- **Notification orchestration requires targeted communication:** You cannot schedule a condition-triggered message until the basic `EventCommunication` model with audience targeting exists. Orchestration is the scheduling layer on top of communication primitives.

- **Template Intelligence requires at least one completed event:** The AI lessons-learned feature analyzes the activity log and post-event feedback of a completed event. It literally cannot function until events have been run through the platform at least once.

---

## MVP Definition

The v3.0 milestone is itself the "MVP" for the event planning system. Within v3.0, there is a phased delivery order.

### Phase 1: Event Foundation — Launch With

The minimum needed to prove the concept and begin using EventProjects internally (staff-facing only, no public pages).

- [x] EventProject model as hub — connects to CalendarEvent, adds metadata fields
- [x] EventProject hub page with all sections (empty state initially is fine)
- [x] Three entry paths: Planning Season publish → EventProject, EventSeries recurring setup, Direct request
- [x] Calendar reads EventProject data (backward compatible — existing CalendarEvents still work)
- [x] Navigation reorientation (sidebar restructure: Events primary, Calendar/Planning nested)
- [x] Event activity log (automatic tracking of all changes — append-only, server-side)
- [x] EventTask checklist (simple to-do items with assignee + due date)
- [x] Smart action dashboard (AI-prioritized action items across all active events)

**Why these are first:** The EventProject hub must exist before anything else can attach to it. This phase proves the new information architecture and gives staff the workspace to begin planning in — even before registration goes live.

### Phase 2: Registration and Public Pages — Add After Foundation

- [x] Registration Form Builder (common fields + custom fields + multi-page sections)
- [x] Public-facing event page (school branding, split panel, mobile-first)
- [x] EventRegistration model (status, payment tracking, document tracking)
- [x] Stripe payment integration (Stripe Elements, deposits, payment plans, discount codes)
- [x] E-signature capture (finger on mobile, typed name on desktop; timestamp + IP)
- [x] Confirmation email with QR code (extends existing Resend service)
- [x] Magic link / code-based access for parents (secure cookie session tied to registration)
- [x] Participant personal dashboard (schedule, group stubs, announcements, outstanding docs)
- [x] Share/Distribution Hub (link, QR for flyers, email to parent list, branding controls)
- [x] Registration capacity + waitlist management

**Why these are second:** Public pages introduce a new security surface (public API endpoints, untrusted input, rate limiting, spam prevention). They must be built after the EventProject model is stable so they have something meaningful to display. Stripe integration is high complexity — needs its own phase.

### Phase 3: Documents, Groups, Communication, and Day-Of

- [x] EventDocument model with signature capture
- [x] Per-participant document completion tracking + targeted reminders
- [x] EventGroup model (BUS, CABIN, SMALL_GROUP, ACTIVITY)
- [x] Drag-and-drop group assignment UI
- [x] Printable everything (bus manifests, cabin rosters, medical summaries, emergency contacts)
- [x] ActivitySignup for elective schedule items with capacity
- [x] Dietary and medical aggregation reports
- [x] EventCommunication with audience targeting (all, group, incomplete-docs, paid-only)
- [x] QR code check-in scanning (validates against registration data)
- [x] Real-time check-in counter (SSE or polling)
- [x] Compliance checklist for off-campus events
- [x] EventIncident logging (for day-of incidents — online + offline queue)
- [x] Offline PWA day-of tools (rosters, QR scanning, incident log, headcount)

**Why these are third:** Documents require registered participants. Groups require registered participants. Communication targeting requires knowing who registered and what their status is. The offline PWA requires stable data models for what to cache.

### Phase 4: Budget, AI, Notifications, and Templates

- [x] EventBudgetLine model (category, budgeted, actual, INCOME/EXPENSE)
- [x] Budget vs. actual reporting with per-participant cost analysis
- [x] Notification orchestration (automated timeline + condition-based triggers + AI drafts)
- [x] Smart Event Creation from natural language
- [x] AI form generation
- [x] AI group assignments (initial cabin/bus assignments with constraints)
- [x] Intelligent conflict detection (weather risk, SAT weekend, audience overlap)
- [x] AI-generated budget estimation from historical data
- [x] Communication drafting with event context
- [x] Post-event feedback surveys + AI analysis
- [x] Save as Template / Create from Template
- [x] AI-enhanced templates (auto-update dates, lessons learned from activity log)
- [x] Planning Center integration (Services, People, Check-Ins)
- [x] Google Calendar sync (existing CalendarFeedConnection model — extend for EventProject)
- [x] Twilio SMS notifications

**Why these are last:** AI features require their non-AI counterparts to exist first. Budget is self-contained but adds less urgency than registration/groups/communication. Templates require completed events in the system. Integrations depend on stable internal models.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| EventProject hub page | HIGH | MEDIUM | P1 |
| Three entry paths | HIGH | HIGH | P1 |
| Activity log | HIGH | LOW | P1 |
| Navigation reorientation | HIGH | LOW | P1 |
| Public event page + school branding | HIGH | MEDIUM | P1 |
| Registration form builder | HIGH | HIGH | P1 |
| Stripe payment integration | HIGH | HIGH | P1 |
| E-signature capture | HIGH | MEDIUM | P1 |
| Magic link parent access | HIGH | MEDIUM | P1 |
| QR code per registration | HIGH | LOW | P1 |
| QR check-in with real-time count | HIGH | MEDIUM | P1 |
| Drag-and-drop group assignment | HIGH | HIGH | P1 |
| Printable bus manifests + rosters | HIGH | MEDIUM | P1 |
| Document completion tracking | HIGH | MEDIUM | P1 |
| Targeted announcements | HIGH | MEDIUM | P2 |
| Participant personal dashboard | HIGH | MEDIUM | P2 |
| Notification orchestration | HIGH | HIGH | P2 |
| Dietary/medical aggregation reports | HIGH | LOW | P2 |
| Offline PWA day-of tools | HIGH | HIGH | P2 |
| ActivitySignup + elective capacity | MEDIUM | MEDIUM | P2 |
| Budget line items + tracking | MEDIUM | MEDIUM | P2 |
| AI event creation | HIGH | HIGH | P2 |
| AI form generation | HIGH | HIGH | P2 |
| AI group assignments | HIGH | HIGH | P2 |
| Save as Template | HIGH | MEDIUM | P2 |
| AI-enhanced templates | HIGH | HIGH | P3 |
| Intelligent conflict detection | MEDIUM | HIGH | P3 |
| Budget vs. actual with per-participant cost | MEDIUM | LOW | P3 |
| Post-event feedback surveys | MEDIUM | LOW | P3 |
| Real-time collaboration + presence | MEDIUM | HIGH | P3 |
| Planning Center integration | MEDIUM | HIGH | P3 |
| Google Calendar sync | MEDIUM | MEDIUM | P3 |
| Twilio SMS | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Ships in v3.0 Phases 1–3 (registration, groups, day-of tools)
- P2: Ships in v3.0 Phase 4 (AI, budget, orchestration, templates)
- P3: Post-v3.0 or late Phase 4 (integrations, advanced collaboration)

---

## Competitor Feature Analysis

Based on research into K-12 school event platforms (Sched, Planning Pod, RSVPify, CampDoc, CampBrain, iCampPro, CampSite/CampMinder, Jumbula, Aryval, Raptor EventSafe), generic form builders (Jotform, Google Forms), and the primary competitor for school-centric workflows (Planning Center).

| Feature | Planning Center | CampDoc / CampBrain | Generic Platforms (Sched, RSVPify) | Lionheart Approach |
|---------|-----------------|---------------------|-------------------------------------|-------------------|
| Event workspace hub | Services module — worship-focused, not general event planning | Camp-specific, not general school events | No planning workspace — registration only | EventProject unifies all sections in one workspace for any event type |
| Registration forms | Basic — no multi-page, no conditional | Full camp forms (medical, dietary, cabins) — best in class | Multi-page registration, payments | Multi-page with common fields, Stripe, e-signature — comparable to CampDoc |
| Payment processing | Giving module (donations) — not event registration payments | Full payment plans, scholarships | Stripe-backed with deposits | Stripe Elements with deposits, payment plans, discount codes |
| E-signature | No built-in signature capture | Built-in for health forms | Varies — usually third-party | Built-in finger/typed signature, timestamp + IP |
| QR check-in | Check-Ins module — excellent, purpose-built | Not built-in | QR for entry only | QR as participant identity (check-in + cabin + activities + medical + parent visibility) |
| Group management | Not available | Cabin assignments with drag-and-drop | Not available | Drag-and-drop with AI initial assignment |
| Day-of offline tools | No offline capability | No offline capability | No offline capability | PWA with offline caching (extends existing Maintenance PWA) |
| AI features | No AI | No AI | No AI | Full AI suite — creation, forms, groups, conflict detection, templates |
| Parent portal | Account required | Account required | Account required | Magic link / no-account access, participant dashboard at same URL |
| Notification orchestration | Automated messaging in some modules | Basic email reminders | Basic email reminders | Condition-based triggers + AI drafting + approval before send |
| Budget tracking | Not available | Not available | Not available | Line-item budget with revenue/expense, per-participant cost analysis |
| Templates with lessons learned | Partial — copy last year's plan | Partial — copy forms | Not available | AI-enhanced with auto-updated dates, inflated budget, lessons from activity log |
| Medical aggregation | Not available | Core feature — medical health record per camper | Not available | Aggregated from registration, formatted for nurse/kitchen |
| Printable materials | Not available | Cabin rosters, bus lists | Not available | All printables (bus manifest, cabin roster, medical summary, emergency contacts, schedule poster) |
| School integration | Purpose-built for churches/schools | Camp-focused | Generic | Native — org-scoped, campus-aware, uses existing building/room hierarchy |

**Key insight from competitor analysis:** No single platform does all of this. Schools currently use Planning Center for worship planning, CampDoc for camp registration/medical, Google Forms for general registration, spreadsheets for group assignments, and Mailchimp for communications. Lionheart's competitive advantage is consolidating all of these into one platform that is already the school's operational backbone (maintenance, IT, campus management).

---

## How Production Features Actually Work

Understanding expected production behavior prevents under-building or building wrong.

### Registration Form Builder

Production behavior in camp registration platforms:

- **Common fields are pre-built columns** on `EventRegistration` (e.g., `emergencyContact1Name`, `allergies`, `tShirtSize`). The planner toggles them on/off; they map directly to typed columns. No JSON parsing needed for common fields.
- **Custom fields are JSON** stored on the form definition. The registration response stores custom field answers as `{ fieldId: value }` JSON. At read time, merge custom field schema with answer values.
- **Multi-page is section grouping** — sections are ordered groups of fields. The page count is the number of sections. No branching between pages.
- **Payment is a special section** — it always appears as the last section before signatures. Stripe Elements mounts into a `div` — cannot be in a React Server Component; must use `'use client'`.
- **Signatures are one per document** — a signature field contains the full agreement text + a signature capture area. On mobile: HTML5 Canvas `<canvas>` element with touch events for finger drawing. On desktop: a text input with `"Type your full name"` label. Store the signed text or base64 canvas PNG + timestamp + IP.
- **Form state must survive page navigation** — parents fill 2 pages, their phone locks, they come back. Form state must persist across browser sessions (localStorage or sessionStorage keyed to the registration draft ID).

### Magic Link Authentication for Parents

Production behavior (confirmed via magic link research):

- Initial email contains a one-time link with a short-lived token (15-30 min expiry).
- When clicked, the server validates the token, creates a persistent session cookie (httpOnly, Secure, SameSite=Strict), and redirects to the participant dashboard.
- The session cookie has a longer TTL (7-30 days) — the parent should not need to re-request a magic link every visit.
- Token is single-use: consuming it invalidates it. Reuse of an expired/used token must return a clear error with a "send me a new link" button.
- Access control: the magic link session only grants access to the specific registration record it was issued for. It cannot browse other events or access staff-facing pages.
- Rate limiting: magic link request endpoint must be rate-limited (3 requests per email per hour) to prevent abuse.

### QR Code Check-In

Production behavior (confirmed across Aryval, Raptor EventSafe, Planning Pod):

- QR code encodes the registration ID (UUID) — not the full participant record.
- When scanned, the system performs a lookup: `EventRegistration.findById(qrCode)`.
- The lookup endpoint is protected by staff authentication but not org-level JWT — staff may be scanning on a shared device at a check-in table.
- Result shows: student name, photo (if uploaded), current check-in status, group assignments, and any critical flags (incomplete docs, medical flags, payment outstanding).
- Check-in writes `checkedInAt` timestamp on `EventRegistration`. Idempotent — scanning the same code twice does not error.
- Real-time counter: `eventProject.checkedInCount` is a computed field or a cached counter. SSE pushes the updated count to the coordinator's dashboard when it changes.
- Offline mode: The service worker caches the registration list on page load. QR validation runs against the local cache. Check-in writes to IndexedDB queue. Syncs when connectivity returns.

### Drag-and-Drop Group Assignment

Production behavior (confirmed in CampBrain, iCampPro, CampSite):

- Source list: all registered + paid participants not yet assigned to a group of this type.
- Target: columns or rows representing each group, showing current count vs. capacity.
- Dragging: `dnd-kit` already installed. Use `useDraggable` + `useDroppable`. Optimistic update on drop; server validates and confirms or rejects.
- Constraints: a group can have a max capacity set when created. Dropping past capacity shows a warning (allowed but flagged), not a hard block.
- Friend request display: if a participant listed cabin mate preferences in registration, show a small indicator on their card ("requested with Jamie") so the planner can honor it.
- Medical/dietary flags: show a small icon on each participant card in the assignment view (not the full record — just a "has flags, click to see" indicator).
- Save is automatic on drop (not a "save" button). Each drop is an immediate mutation.
- Print triggers from the group view: "Print Bus 1 Manifest" button on each group column.

### Notification Orchestration

Production behavior (based on event communication research + vision doc):

- The planner builds a communication timeline during the planning phase — not ad hoc during execution.
- Each timeline entry has: trigger (date offset from event, e.g., "-14 days") or condition ("registration.count >= 0.80 * capacity"), audience filter, subject, body (AI-drafted, planner-editable), channel (email, in-app, SMS).
- Before each send, the system sends a "about to send this message — edit or skip" notification to the event coordinator. Default is "send as scheduled" if no action taken within 24 hours.
- Condition triggers are evaluated by a scheduled job (Vercel Cron, same pattern as PM engine). Each condition check is idempotent — if the condition was already triggered and the message sent, do not re-send.
- An audit trail records every sent communication: who triggered it, when, what audience, what message was actually sent (preserves the final state after any edits).

### Offline PWA for Day-Of

The Maintenance module already implements the complete offline pattern (Serwist + Dexie). For event day-of tools:

- Cache strategy for event data: cache-first for static assets; network-first with cache fallback for event rosters, group assignments, and participant records.
- Data cached on page load: full participant list + photos, group assignments, schedule, medical flags for authorized staff.
- Mutations while offline: check-in events, headcount entries, incident logs queued in Dexie with an idempotency key.
- Sync on reconnect: Background Sync API (where supported) triggers the queue drain. Fallback: drain queue on next successful `fetch`.
- Medical data offline: encrypted in IndexedDB using the Web Crypto API. Key derived from the staff member's session token. Medical data is cached only for authorized roles (medical staff, event leaders) — not for all logged-in users.
- Photo caching: participant photos cached as blob URLs. Offline roster shows the cached photo. Photos are the largest offline payload — cache only thumbnail versions (200x200px) for day-of use.

---

## Dependencies on Existing Lionheart Systems

Features in this milestone that depend on existing platform infrastructure:

| New Feature | Existing System Used | Integration Notes |
|-------------|---------------------|-------------------|
| Public event page branding | `/api/branding` endpoint | Already returns org logo, name, colors — plug directly into public page header |
| QR code generation | `qrcode.react` (already installed for maintenance assets) | Same library, different data (registration ID vs. asset ID) |
| Confirmation emails | Resend via `emailService.ts` | New email template type: `EventConfirmation`. Extend existing template system. |
| In-app notifications | Existing `Notification` model | New notification types: event-specific triggers. Existing bell component unchanged. |
| File/photo uploads | Supabase Storage + signed URL pattern | Same signed URL pattern as maintenance ticket photos. New bucket: `event-registrations` |
| Campus/room selection in EventProject | `Building`, `Area`, `Room` models | Facility booking is a logistics item on the EventProject. Same campus hierarchy. |
| AI features | Gemini (`@google/genai`) | Same service layer. New prompts for event context (creation, forms, groups, summaries). |
| Offline PWA | Serwist + Dexie (already in Maintenance module) | New service worker routes for event data. Same IndexedDB mutation queue pattern. |
| PDF printables | `@react-pdf/renderer` (already installed) | New document templates for bus manifests, cabin rosters, medical summaries. |
| Google Calendar sync | `CalendarFeedConnection` + `EventSyncMapping` models | EventProject-linked CalendarEvents already sync via existing mechanism. |
| Permission system | Existing `PERMISSIONS` constants + `assertCan` | New permissions: `events:project:manage`, `events:registration:view`, `events:medical:view` |
| Multi-tenancy | `runWithOrgContext` + org-scoped Prisma | All new models must be registered in `src/lib/db/index.ts` org-scope whitelist |
| Payments (Stripe) | New — no existing payment processing | Stripe Elements for PCI compliance. New: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` env vars. |
| Parent magic link auth | New — no existing unauthenticated parent access | New public API routes under `/api/public/events/` and `/api/public/registrations/`. Separate auth flow from staff JWT. Rate limiting required. |

---

## Sources

- [Sched: Event Registration Software for Schools Guide (2025)](https://sched.com/blog/event-registration-software-for-schools-guide/) — MEDIUM confidence (first-party marketing)
- [RSVPify: Event Software for K-12 and Higher Education](https://rsvpify.com/education/) — MEDIUM confidence (first-party)
- [Almabase: Best Event Management Tools for K-12 (2025)](https://www.almabase.com/blog/best-event-management-software-k-12-higher-ed) — MEDIUM confidence (third-party roundup)
- [Planning Pod: Education Event Management Software](https://www.planningpod.com/education-event-management-software-universities.cfm) — MEDIUM confidence (first-party)
- [Raptor EventSafe: School Event Management](https://raptortech.com/raptor-eventsafe/) — MEDIUM confidence (first-party)
- [CampDoc: Camp Registration Software](https://www.campdoc.com/registration/) — HIGH confidence (confirmed medical + registration features)
- [CampBrain: Faith-Based Camp Management](https://campbrain.com/faith-based/) — MEDIUM confidence (confirms drag-and-drop "Cabinizer")
- [iCampPro: Camp Management Software Features](https://www.icamppro.com/camp-management-software-features) — MEDIUM confidence (confirms drag-and-drop group assignments)
- [CampSite Features (CampManagement.com)](https://campmanagement.com/features/) — MEDIUM confidence (confirms "Bunking Board" pattern)
- [CampMinder: Bunk Assignment Software](https://campminder.com/resources/how-new-software-for-bunk-assignments-is-making-history/) — HIGH confidence (confirms drag-and-drop is standard, no AI)
- [Regpacks: Field Trip Management Software](https://www.regpacks.com/field-trip-management-software/) — MEDIUM confidence (confirms payment plan importance rating)
- [Jumbula: Camp Registration Software](https://jumbula.com/markets/camp-registration-software/) — MEDIUM confidence (first-party)
- [Planning Center: Registrations and Check-Ins Integration](https://www.planningcenter.com/blog/2017/06/introducing-registrations-check-ins-integration) — HIGH confidence (official blog, confirms Check-Ins integration pattern)
- [Planning Center API Documentation](https://developer.planning.center/docs/) — HIGH confidence (official API docs)
- [Aryval: All-in-One Event Management for K-12](https://aryval.io/aryval-events) — MEDIUM confidence (first-party, confirms QR family entry ticket pattern)
- [GetApp: Best K-12 Software with Event Management 2026](https://www.getapp.com/education-childcare-software/k-12/f/event-management/) — MEDIUM confidence (third-party review aggregator)
- [Magic Links Guide (EngageLab 2025)](https://www.engagelab.com/blog/magic-links) — HIGH confidence (token expiry and UX patterns confirmed)
- [Supertokens: Magic Links Best Practices](https://supertokens.com/blog/magiclinks) — HIGH confidence (15-30 min expiry standard confirmed)
- [FERPA Compliance Guide 2026 (UpGuard)](https://www.upguard.com/blog/ferpa-compliance-guide) — HIGH confidence (FERPA scope for student registration data)
- [COPPA 2025 Amendments (SecurePrivacy)](https://secureprivacy.ai/blog/school-data-governance-software-ferpa-coppa-k-12) — HIGH confidence (2025 COPPA amendments confirmed, April 2026 full compliance deadline)
- [Stripe Payment Element Best Practices](https://docs.stripe.com/payments/payment-element/best-practices) — HIGH confidence (official Stripe docs)
- [PWA QR Code Scanner (GitHub: Minishlink)](https://github.com/Minishlink/pwa-qr-code-scanner) — HIGH confidence (confirms PWA offline QR scanning is achievable)
- [MDN: PWA Offline Service Workers](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Offline_Service_workers) — HIGH confidence (official MDN docs)
- Vision document: "Event Planning Feature Exploration.docx" — HIGH confidence (primary source, direct product specification including Big Bear camp scenario, data models, phase plan)
- `.planning/PROJECT.md` — HIGH confidence (primary source, validated requirements and constraints)
- `prisma/schema.prisma` (direct codebase inspection) — HIGH confidence (existing CalendarEvent, PlanningSeason, PlanningSubmission, EventApproval, EventResourceRequest models confirmed)

---

*Feature research for: K-12 School Event Planning System (Lionheart v3.0)*
*Researched: 2026-03-14*
