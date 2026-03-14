# Lionheart Platform

## What This Is

A comprehensive K-12 educational institution management SaaS platform built around two core loops: **Events** (planning things that will happen) and **Tickets** (responding to things that already happened). Multi-tenant Next.js 15 app with Supabase/PostgreSQL serving schools across Event Planning, Maintenance, IT Help Desk, Athletics, and Campus Management modules. The platform enables teachers, staff, administrators, parents, and maintenance teams to manage daily operations from a single campus-aware system.

## Core Value

Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.

## Current Milestone: v3.0 Events Are the Product

**Goal:** Reorient the platform around events as the organizing principle. Every approved event becomes an Event Project — a full planning workspace with registration, forms, documents, logistics, budgets, communication, and day-of tools. Add public-facing pages for parent/participant interaction without accounts.

**Target features:**
- EventProject model as the hub connecting all event data
- Three entry paths: Planning Seasons, Recurring Series, Direct Requests
- Event project page with all sections (Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms)
- Public-facing event pages with school branding (first public-facing pages in Lionheart)
- Multi-page form builder with common fields, custom fields, payment (Stripe), and signature capture
- QR code system for check-in, headcounts, activity signups, medical access
- Document tracking with signature capture (mobile finger, desktop typed)
- Group management (buses, cabins, small groups) with drag-and-drop assignment
- Printable everything (bus manifests, cabin rosters, medical summaries, emergency contacts)
- Budget tracking with line-item detail and per-participant cost analysis
- Notification orchestration with automated communication timelines and condition-based triggers
- Real-time collaboration via WebSocket/SSE with presence indicators
- PWA with offline capability for day-of operations (rosters, QR scanning, incident logging)
- AI-powered event creation, form generation, schedule building, group assignments, status summaries
- Event templates with AI-enhanced reuse (auto-update dates, surface lessons learned)
- Navigation reorientation (Events as primary, Calendar/Planning nested under it)
- Planning Center, Google Calendar, Twilio integrations

## Requirements

### Validated

- ✓ Multi-tenant org-scoped architecture — v1.0
- ✓ Campus/Building/Area/Room physical hierarchy — v1.0
- ✓ JWT authentication with role-based permissions — v1.0
- ✓ Email notifications via Resend — v1.0
- ✓ In-app notification system — v1.0
- ✓ Module toggle system (AddOnsTab) — v1.0
- ✓ Maintenance ticket lifecycle (8-status Kanban) — v1.0
- ✓ AI photo diagnosis (Anthropic Claude) — v1.0
- ✓ Asset register with QR codes — v1.0
- ✓ Preventive maintenance scheduling — v1.0
- ✓ Analytics dashboard — v1.0
- ✓ Compliance calendar (10 domains) — v1.0
- ✓ Board reporting with FCI score — v1.0
- ✓ Knowledge base — v1.0
- ✓ Offline PWA — v1.0
- ✓ Athletics module (sports, seasons, teams, games, tournaments, stats) — v1.0
- ✓ IT Help Desk (tickets, devices, deployment batches) — v1.0
- ✓ Calendar & Events system — v1.0
- ✓ Global search (Cmd+K) — v1.0
- ✓ Glassmorphism design system — v1.0

### Active

**v3.0 — Event Foundation:**
- [ ] EventProject and EventSeries data models
- [ ] Event project page with all sections (empty states initially)
- [ ] Three entry paths (planning season publish, recurring series, direct request)
- [ ] Calendar reads from EventProject data
- [ ] Navigation reorientation (Events primary, Calendar/Planning nested)
- [ ] Event activity log (automatic tracking of all changes)
- [ ] Smart action dashboard (AI-prioritized action items)

**v3.0 — Registration & Public Pages:**
- [ ] Form builder with common fields, custom fields, multi-page forms
- [ ] Public-facing event page (school branding, split-panel, mobile-first)
- [ ] EventRegistration model with status/payment tracking
- [ ] Share/distribution hub (link, QR code, email)
- [ ] Magic link / code-based access for parents
- [ ] QR code per registration (confirmation emails, wristbands)
- [ ] Participant personal dashboard (schedule, groups, announcements)
- [ ] Photo upload during registration

**v3.0 — Documents & Signatures:**
- [ ] EventDocument model with templates
- [ ] Signature capture (finger on mobile, typed on desktop)
- [ ] Per-participant document completion tracking
- [ ] Compliance checklists for off-campus events

**v3.0 — Groups & Logistics:**
- [ ] EventGroup model (buses, cabins, small groups, activity groups)
- [ ] Drag-and-drop group assignment UI
- [ ] Printable everything (bus manifests, cabin rosters, medical summaries, etc.)
- [ ] ActivitySignup for elective schedule items with capacity
- [ ] Dietary and medical aggregation reports

**v3.0 — Payments & Budget:**
- [ ] Stripe payment integration (Elements for PCI compliance)
- [ ] Deposits, payment plans, scholarship/discount codes
- [ ] EventBudgetLine model with line-item tracking
- [ ] Budget vs. actual reporting and per-participant cost analysis

**v3.0 — Communication & Day-Of:**
- [ ] EventCommunication with audience targeting
- [ ] Notification orchestration (timeline + condition triggers + AI drafts)
- [ ] QR code scanning for check-in, headcounts, session attendance
- [ ] Real-time collaboration (WebSocket/SSE, presence indicators)
- [ ] PWA with offline capability (rosters, QR scanning, incident logging)
- [ ] EventIncident logging (online and offline)
- [ ] Post-event feedback surveys

**v3.0 — AI Features:**
- [ ] Smart event creation from natural language
- [ ] Intelligent conflict detection (weather, testing, audience overlap)
- [ ] AI-generated registration forms and schedules
- [ ] AI-assisted group assignments
- [ ] Budget estimation from historical data
- [ ] Communication drafting with event context
- [ ] Post-event feedback analysis

**v3.0 — Templates & Integrations:**
- [ ] Save as Template / Create from Template
- [ ] AI-enhanced templates (auto-update dates, surface lessons learned)
- [ ] Planning Center integration (Services, People, Check-Ins)
- [ ] Google Calendar sync
- [ ] SMS notifications via Twilio

### Out of Scope

- Vendor portal for external contractors — deferred to post-v3 decision
- SIS integration / auto-provisioning — depends on platform SSO work
- Budget integration with financial systems (Munis/Tyler) — future milestone
- 2FA / MFA support — deferred to v3.1
- OAuth integration (Google/Microsoft login) — deferred to v3.1
- Conditional form logic (branching, calculated fields) — external tool integration covers edge cases
- DocuSign/HelloSign integration — built-in signatures handle 95% of needs, integration deferred
- Native mobile app — PWA approach sufficient, no App Store split development
- Video streaming within events — storage/bandwidth, use external embeds
- Complex form branching/calculated fields — Jotform/Google Forms integration for edge cases

## Context

- **Existing codebase**: 66+ database models, 281 API routes, 128 API groups, 9 settings tabs
- **Platform modules**: Calendar, Maintenance, IT Help Desk, Athletics, Campus Management
- **v2.0 completed**: Auth hardening, legal pages, inventory, billing, audit logs, unit tests, CI/CD, logging, pagination — 18 phases, 57 plans
- **Maintenance module**: Most complete module — full ticket lifecycle, Kanban, AI diagnostics, assets, PM, compliance, knowledge base, offline PWA
- **IT Help Desk**: Well-implemented — ticket lifecycle, comments, magic links, device management
- **Athletics**: Good coverage — sports, seasons, teams, games, tournaments, stats, standings
- **AI stack**: Google Gemini (`@google/genai`) for all AI features (reverted from Claude)
- **Storage**: Supabase Storage for photos, receipts, compliance documents
- **Key v3.0 consideration**: First public-facing pages — introduces new security surface (rate limiting, spam prevention, untrusted input validation, magic-link auth for parents)
- **Key v3.0 consideration**: Payment processing via Stripe Elements (PCI compliance — card data never touches Lionheart servers)
- **Key v3.0 consideration**: FERPA/COPPA compliance for student medical data, photos, emergency contacts
- **Vision document**: "Event Planning Feature Exploration.docx" — comprehensive product spec with data models, UI flows, scenarios (Big Bear Camp), and phased implementation plan

## Constraints

- **Tech stack**: Next.js 15 + Prisma + Supabase/PostgreSQL — no framework changes
- **Multi-tenancy**: All new models must be org-scoped using `runWithOrgContext` pattern
- **Auth**: JWT auth + httpOnly cookies (v2.0 migration complete)
- **UI consistency**: Glassmorphism design system (ui-glass classes, Framer Motion animations)
- **Privacy**: FERPA/COPPA compliance for student data — encryption at rest, strict access controls, audit logging, data retention policies
- **PCI compliance**: Stripe Elements only — never store or transmit raw card numbers
- **Public pages**: Rate limiting, spam prevention, CAPTCHA on forms, secure magic-link auth for parents
- **Backward compatibility**: Existing calendar and planning season workflows must continue working throughout transition
- **Mobile-first**: Public-facing pages and day-of tools designed mobile-first; staff event project page can remain desktop-optimized

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate MaintenanceTicket model (not extending existing Ticket) | Maintenance tickets have fundamentally different lifecycle, fields, and behaviors | ✓ Good |
| Claude API for AI diagnostics (not Gemini) | Better for photo analysis and free-form troubleshooting | ✓ Good |
| Supabase Storage for all file uploads | Consistent with existing infrastructure, native to the stack | ✓ Good |
| 8-status Kanban (not simplified) | SCHEDULED and QA statuses solve real Linfield pain points | ✓ Good |
| v2.0 = Tier 1 + Tier 2 gaps only | Tier 3 items (2FA, OAuth, Redis) deferred to v2.1 to keep scope manageable | — Pending |
| httpOnly cookies for JWT (replacing localStorage) | XSS vulnerability in current localStorage approach | — Pending |
| Vitest for unit tests (not Jest) | Better ESM support, faster, native TypeScript | — Pending |
| Pino for structured logging (not Winston) | Lower overhead, JSON-native, better for serverless | — Pending |
| Sentry for error tracking | Industry standard, good Next.js integration | — Pending |

| EventProject as hub model (not extending CalendarEvent) | Events need fundamentally different data: registration, forms, groups, budget, comms — too much for the existing model | — Pending |
| Stripe Elements for payments (not Square) | Stripe has better developer experience, more payment methods, better documentation | — Pending |
| PWA for offline (not native app) | Works on any phone, no App Store approval, no Android/iOS split development | — Pending |
| Show Everything design (no event type tiers) | Empty sections serve as built-in checklist, first-time planners discover capabilities | — Pending |
| Magic link auth for parents (not account creation) | Parents shouldn't need to know Lionheart exists — just their school's branded event page | — Pending |

---
*Last updated: 2026-03-14 after v3.0 milestone initialization*
