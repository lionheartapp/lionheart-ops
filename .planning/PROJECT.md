# Lionheart Platform

## What This Is

A comprehensive K-12 educational institution management SaaS platform built around two core loops: **Events** (planning things that will happen) and **Tickets** (responding to things that already happened). Multi-tenant Next.js 15 app with Supabase/PostgreSQL serving schools across Event Planning, Maintenance, IT Help Desk, Athletics, and Campus Management modules. The platform enables staff to manage event projects with registration, forms, documents, logistics, budgets, communication, and day-of execution — all branded as the school — while parents interact through public-facing pages without needing accounts.

## Core Value

Lionheart helps schools plan and run everything that happens — from weekly staff meetings to week-long camps — with registration, forms, signatures, logistics, communication, budget tracking, and day-of execution, all in one place, all branded as the school.

## Requirements

### Validated

- ✓ Multi-tenant org-scoped architecture — v1.0
- ✓ Campus/Building/Area/Room physical hierarchy — v1.0
- ✓ JWT authentication with role-based permissions — v1.0
- ✓ Email notifications via Resend — v1.0
- ✓ In-app notification system — v1.0
- ✓ Module toggle system (AddOnsTab) — v1.0
- ✓ Maintenance ticket lifecycle (8-status Kanban) — v1.0
- ✓ AI photo diagnosis (Gemini) — v1.0
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
- ✓ httpOnly cookie auth with JWT refresh — v2.0
- ✓ Legal & compliance pages (ToS, privacy, FERPA, cookie consent) — v2.0
- ✓ Inventory management with categorization and low-stock alerts — v2.0
- ✓ Stripe subscription billing with plan management — v2.0
- ✓ Append-only audit logging — v2.0
- ✓ Vitest unit test suite with 80% coverage threshold — v2.0
- ✓ CI/CD pipeline with preview deployments — v2.0
- ✓ Pino structured logging with Sentry integration — v2.0
- ✓ Cursor-based pagination on all list endpoints — v2.0
- ✓ EventProject hub model with 8-tab workspace — v3.0
- ✓ Three event entry paths (planning seasons, recurring series, direct requests) — v3.0
- ✓ AI-prioritized event action dashboard — v3.0
- ✓ Public registration with multi-step form builder and Stripe payments — v3.0
- ✓ E-signature capture (mobile finger, desktop typed) — v3.0
- ✓ Magic-link parent portal (no account required) — v3.0
- ✓ QR code system (check-in, headcounts, self-service) — v3.0
- ✓ Document completion tracking with compliance checklists — v3.0
- ✓ Drag-and-drop group management (buses, cabins, small groups) — v3.0
- ✓ Printable PDFs (bus manifests, cabin rosters, medical summaries) — v3.0
- ✓ Event budget tracking with line-item detail — v3.0
- ✓ Notification orchestration with automated timelines — v3.0
- ✓ AI event creation, form/schedule/group generation, and feedback analysis — v3.0
- ✓ Event templates with AI-enhanced reuse — v3.0
- ✓ Planning Center, Google Calendar, Twilio integrations — v3.0
- ✓ Day-of offline PWA (QR scanning, incident logging, Dexie sync) — v3.0
- ✓ FERPA/COPPA compliant medical data isolation — v3.0
- ✓ Cloudflare Turnstile CAPTCHA on public forms — v3.0

### Active

(No active requirements — define with `/gsd:new-milestone`)

### Out of Scope

- Vendor portal for external contractors — deferred to post-v3 decision
- SIS integration / auto-provisioning (PowerSchool, Clever, Infinite Campus) — depends on platform SSO work
- Budget integration with financial systems (Munis/Tyler) — future milestone
- 2FA / MFA support — deferred to v3.1
- OAuth integration (Google/Microsoft login) — deferred to v3.1
- Conditional form logic (branching, calculated fields) — Jotform embed covers edge cases
- DocuSign/HelloSign integration — built-in signatures handle 95% of needs
- Native mobile app — PWA approach sufficient, no App Store split development
- Video streaming within events — use external embeds (YouTube/Zoom)
- Complex multi-step approval workflows — single admin gate covers 95% of schools
- Participant-to-participant social features — COPPA risk for under-13; group announcements suffice
- Automated payment reconciliation — future milestone
- Public event discovery / school-wide event calendar — future milestone

## Context

**Shipped v3.0** with 205,642 LOC TypeScript across 1,003 files.
Tech stack: Next.js 15, Prisma, Supabase/PostgreSQL, Stripe, Google Gemini, Resend, Tailwind CSS, TanStack Query, Framer Motion.
Platform: 66+ database models, 281+ API routes, 9 settings tabs, 6 major modules.
Three milestones shipped: v1.0 (Maintenance & Facilities), v2.0 (Launch Readiness), v3.0 (Events Are the Product).
Total: 22 phases, 112 plans across all milestones.

## Constraints

- **Tech stack**: Next.js 15 + Prisma + Supabase/PostgreSQL — no framework changes
- **Multi-tenancy**: All new models must be org-scoped using `runWithOrgContext` pattern
- **Auth**: JWT auth + httpOnly cookies (v2.0 migration complete)
- **UI consistency**: Glassmorphism design system (ui-glass classes, Framer Motion animations)
- **Privacy**: FERPA/COPPA compliance for student data — encryption at rest, strict access controls, audit logging
- **PCI compliance**: Stripe Elements only — never store or transmit raw card numbers
- **Public pages**: Rate limiting, spam prevention, CAPTCHA on forms, secure magic-link auth for parents
- **Mobile-first**: Public-facing pages and day-of tools designed mobile-first; staff views desktop-optimized

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate MaintenanceTicket model | Maintenance tickets have fundamentally different lifecycle, fields, and behaviors | ✓ Good |
| Gemini API for AI features | Reverted from Claude — consolidated on single AI provider | ✓ Good |
| Supabase Storage for all file uploads | Consistent with existing infrastructure, native to the stack | ✓ Good |
| 8-status Kanban (not simplified) | SCHEDULED and QA statuses solve real Linfield pain points | ✓ Good |
| httpOnly cookies for JWT | XSS vulnerability in previous localStorage approach — v2.0 fix | ✓ Good |
| Vitest for unit tests | Better ESM support, faster, native TypeScript | ✓ Good |
| Pino for structured logging | Lower overhead, JSON-native, better for serverless | ✓ Good |
| Sentry for error tracking | Industry standard, good Next.js integration | ✓ Good |
| EventProject as hub model | Events need fundamentally different data than calendar entries — registration, forms, groups, budget, comms | ✓ Good |
| Stripe Elements for payments | Better developer experience, more payment methods, PCI compliance via tokenization | ✓ Good |
| PWA for offline (not native app) | Works on any phone, no App Store approval, no Android/iOS split development | ✓ Good |
| Show Everything design | Empty sections serve as built-in checklist, first-time planners discover capabilities | ✓ Good |
| Magic link auth for parents | Parents shouldn't need to know Lionheart exists — just their school's branded event page | ✓ Good |
| RegistrationSensitiveData isolation | FERPA/COPPA data in separate table with distinct permission — DB compromise doesn't expose medical data | ✓ Good |
| SHA-256 hashed magic link tokens | Raw token never persisted — even DB compromise doesn't expose tokens | ✓ Good |
| CalendarEvent bridge pattern | Preserves backward compatibility with existing calendar while events become primary | ✓ Good |
| Day-offset template serialization | Portable template reuse across different dates | ✓ Good |
| Separate Dexie database per module | Prevents version conflicts between maintenance and events offline stores | ✓ Good |
| Dynamic imports for cross-service calls | Prevents circular deps in event ecosystem | ✓ Good |
| Two-phase AI fetch (?skipAI=true) | Show data instantly, enhance with AI asynchronously — prevents slow AI from blocking UI | ✓ Good |

---
*Last updated: 2026-03-16 after v3.0 milestone*
