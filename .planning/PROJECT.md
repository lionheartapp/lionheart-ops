# Lionheart Platform

## What This Is

A comprehensive K-12 educational institution management SaaS platform. Multi-tenant Next.js 15 app with Supabase/PostgreSQL serving schools across Calendar, Maintenance, IT Help Desk, Athletics, and Campus Management modules. The platform enables teachers, staff, administrators, and maintenance teams to manage daily operations from a single campus-aware system.

## Core Value

Schools can manage their entire operational workflow — from maintenance requests to event calendars to IT help desk to athletics — in one unified platform with role-based access, multi-campus support, and AI-assisted features.

## Current Milestone: v2.0 Launch Readiness

**Goal:** Harden the platform for production launch by closing security gaps, completing unfinished features, building missing pages, and establishing operational infrastructure (tests, CI/CD, logging).

**Target features:**
- Forgot password flow and auth hardening (rate limiting, httpOnly JWT, CSRF)
- Legal pages (Privacy Policy, Terms of Service) and Pricing page
- Webhook signature verification and input sanitization
- Email verification on signup
- Unit tests + CI/CD pipeline
- Structured logging + error tracking (Sentry)
- Pagination on all list endpoints
- Inventory system completion (95% unfinished)
- Draft Events individual CRUD API routes
- Billing UI for organizations
- Audit log viewer in settings
- Dashboard and ticket drawer fixes

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

**v2.0 — Security & Auth:**
- [ ] Forgot password flow (reset endpoint, email template, UI)
- [ ] Rate limiting on login and public endpoints
- [ ] JWT migration from localStorage to httpOnly cookies
- [ ] CSRF protection on state-changing requests
- [ ] Input sanitization framework for XSS prevention
- [ ] Webhook signature verification (Stripe, Clever, ClassLink)
- [ ] Email verification on signup
- [ ] Password complexity rules (beyond 8-char minimum)
- [ ] File upload validation (size limits, MIME checks)

**v2.0 — Missing Pages & Features:**
- [ ] Privacy Policy page
- [ ] Terms of Service page
- [ ] Pricing page
- [ ] About/Contact page
- [ ] Footer links wired to real pages
- [ ] Inventory system CRUD + checkout/checkin workflow + UI
- [ ] Draft Events individual API routes (GET/PUT/DELETE)
- [ ] Dashboard ticket drawer edit button
- [ ] Onboarding re-entry flow

**v2.0 — Infrastructure:**
- [ ] Unit tests (Vitest) + CI/CD pipeline (GitHub Actions)
- [ ] Structured logging (Pino) + error tracking (Sentry)
- [ ] Pagination on all list endpoints
- [ ] Billing/subscription UI for organizations
- [ ] Audit log viewer in settings
- [ ] Data export (CSV/Excel)

### Out of Scope

- Vendor portal for external contractors — deferred to post-v2 decision
- SIS integration / auto-provisioning — depends on platform SSO work
- Budget integration with financial systems (Munis/Tyler) — future milestone
- 2FA / MFA support — deferred to v2.1
- OAuth integration (Google/Microsoft login) — deferred to v2.1
- Session management UI — deferred to v2.1
- Async job queue for email/AI/sync — deferred to v2.1
- Distributed cache (Redis) — deferred to v2.1
- API documentation (OpenAPI) — deferred to v2.1
- Room/resource conflict detection — deferred to v2.1
- Dashboard widget customization — low priority
- Weather widget location fix — low priority

## Context

- **Existing codebase**: 66+ database models, 281 API routes, 128 API groups, 9 settings tabs
- **Platform modules**: Calendar, Maintenance, IT Help Desk, Athletics, Campus Management
- **Gap analysis**: Full audit completed 2026-03-08 (see Lionheart-Gap-Analysis.md)
- **Maintenance module**: Most complete module — full ticket lifecycle, Kanban, AI diagnostics, assets, PM, compliance, knowledge base, offline PWA
- **IT Help Desk**: Well-implemented — ticket lifecycle, comments, magic links, device management
- **Athletics**: Good coverage — sports, seasons, teams, games, tournaments, stats, standings
- **AI stack**: Anthropic Claude for maintenance diagnostics, Google Gemini for other AI features
- **Storage**: Supabase Storage for photos, receipts, compliance documents

## Constraints

- **Tech stack**: Next.js 15 + Prisma + Supabase/PostgreSQL — no framework changes
- **Multi-tenancy**: All new models must be org-scoped using `runWithOrgContext` pattern
- **Auth**: JWT auth + permission system — migrating token storage from localStorage to httpOnly cookies
- **UI consistency**: Glassmorphism design system (ui-glass classes, Framer Motion animations)
- **Legal**: Privacy Policy and Terms must address COPPA/FERPA for K-12 schools
- **Backward compatibility**: Auth migration must not break existing sessions

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

---
*Last updated: 2026-03-08 after v2.0 milestone initialization*
