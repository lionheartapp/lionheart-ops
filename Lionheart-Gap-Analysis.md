# Lionheart Platform — Full Gap Analysis

**Date:** March 8, 2026
**Scope:** End-to-end audit from landing page through every section and backend system

---

## Executive Summary

The Lionheart Platform is a **sophisticated multi-tenant SaaS** with 66+ database models, 281 API routes, and deep module coverage across Calendar, Maintenance, IT Help Desk, Athletics, and Campus Management. The architecture is sound — org-scoping, soft-delete, permission gating, and branded multi-tenancy all work well.

However, the audit reveals gaps in three categories: **incomplete user-facing features** (dead links, missing pages, unfinished flows), **security hardening** (no rate limiting, no webhook verification, localStorage JWT), and **operational readiness** (no CI/CD, no unit tests, no structured logging). Below is every gap found, organized by the user journey.

---

## 1. Landing Page & Marketing

| Gap | Severity | Detail |
|-----|----------|--------|
| **Footer links are dead** | Medium | Features, Pricing, About, Contact, Privacy Policy, Terms of Service all point to `#` |
| **No Pricing page** | High | Prospects have no way to evaluate cost before signing up |
| **No About/Contact page** | Medium | No way for prospects to learn about the company or reach support |
| **No Privacy Policy** | High | Required by law for SaaS collecting user data (COPPA/FERPA for schools) |
| **No Terms of Service** | High | No legal agreement governing platform usage |
| **No product demo or screenshots** | Low | Hero section describes features but doesn't show the actual product |
| **No social proof** | Low | No testimonials, customer logos, or case studies |

---

## 2. Signup & Onboarding

| Gap | Severity | Detail |
|-----|----------|--------|
| **OAuth buttons say "coming soon"** | Medium | Google and Microsoft sign-up buttons are visible but disabled — could confuse users |
| **No email verification on signup** | High | Users can register with typos or fake emails; no `emailVerified` field in User model |
| **Onboarding Step 2 (Members)** | Medium | Page exists but implementation details unclear — may not be fully wired |
| **No onboarding re-entry** | Medium | If a user abandons onboarding, there's no way to resume or skip to dashboard |
| **No trial/billing integration** | Medium | Setup shows "Starting your free trial" but no actual trial period enforcement exists |

---

## 3. Authentication & Security

| Gap | Severity | Detail |
|-----|----------|--------|
| **No Forgot Password flow** | Critical | No "Forgot Password" link, no reset endpoint, no reset email template |
| **No brute force protection** | Critical | No rate limiting on login attempts, no account lockout after failures |
| **JWT stored in localStorage** | High | Vulnerable to XSS attacks; httpOnly cookies would be more secure |
| **No CSRF protection** | High | No CSRF tokens on state-changing requests |
| **No 2FA / MFA** | Medium | No TOTP, SMS, or backup code support |
| **No session management** | Medium | Can't view active sessions or "sign out everywhere" |
| **No "Remember Me" option** | Low | All tokens are 30 days with no short-session option |
| **No password complexity rules** | Medium | Only 8-character minimum; no uppercase, number, or special char requirements |
| **No account self-deletion** | Low | No GDPR-compliant account deletion workflow |
| **OAuth not wired** | Medium | `auth-config.ts` has Google/Microsoft config but it's not connected to the login flow |

---

## 4. Dashboard

| Gap | Severity | Detail |
|-----|----------|--------|
| **"Smart Event" marked "coming soon"** | Low | AI-powered event creation button is visible but disabled |
| **No dashboard widgets/customization** | Low | Dashboard layout is fixed; users can't rearrange or add widgets |
| **Weather widget hard-coded** | Low | Appears to use a fixed location rather than the school's actual address |
| **"Edit" button in ticket drawer not implemented** | Medium | Detail drawer shows an edit button that doesn't work |
| **No recent activity feed** | Low | Dashboard shows "My Tasks" but no feed of recent changes across the org |

---

## 5. Calendar & Events

| Gap | Severity | Detail |
|-----|----------|--------|
| **Three separate event models** | Medium | `Event`, `DraftEvent`, and `CalendarEvent` models overlap — no clear migration path |
| **Draft Events missing API routes** | High | No `/api/draft-events/[id]` routes — can't GET/PUT/DELETE individual drafts |
| **No room/resource conflict detection** | Medium | Two events can be booked for the same room at the same time |
| **No bulk event operations** | Low | Can't mass-update or mass-delete events |
| **No custom fields per event category** | Low | All event types share the same field set |

---

## 6. Tickets (Generic)

| Gap | Severity | Detail |
|-----|----------|--------|
| **No ticket comments/attachments** | Medium | Generic tickets have no discussion thread or file attachments (Maintenance and IT tickets do) |
| **No ticket search** | Medium | Can't search tickets by keyword |
| **No status change history** | Medium | No audit trail of who changed status and when |
| **No bulk operations** | Low | Can't bulk-update, bulk-assign, or bulk-close tickets |
| **No SLA tracking** | Low | No response time or resolution time tracking |

---

## 7. Inventory System

| Gap | Severity | Detail |
|-----|----------|--------|
| **95% incomplete** | Critical | Only a GET endpoint exists — no create, update, or delete |
| **No checkout/checkin workflow** | Critical | Model exists but no transaction tracking |
| **No categories or SKUs** | High | Items have no categorization system |
| **No reorder alerts** | Medium | `reorderThreshold` field exists but nothing checks it |
| **No transaction history** | High | No log of who took or returned items |
| **No UI page** | Critical | No inventory management interface at all |

---

## 8. Settings

| Gap | Severity | Detail |
|-----|----------|--------|
| **No org name/slug editing** | Medium | Organization name and subdomain can't be changed after signup |
| **No billing/subscription UI** | High | Platform admin can manage billing but individual orgs can't view/manage their plan |
| **No audit log viewer** | Medium | API route exists (`/api/settings/audit-logs`) but no UI to view it |
| **No branding settings tab** | Medium | Logo upload works via SchoolInfo, but no dedicated branding page for hero images, colors, etc. |
| **No notification preferences** | Medium | Users can't choose which emails/notifications they receive |
| **No bulk user import** | Medium | Can only invite users one at a time — no CSV import |
| **No integration management** | Low | No UI for managing API keys, webhooks, or third-party connections |
| **No data export** | Medium | No way to export users, tickets, or events as CSV/Excel |
| **Academic Calendar partially implemented** | Medium | UI skeleton exists but API integration unclear |

---

## 9. Maintenance Module

| Gap | Severity | Detail |
|-----|----------|--------|
| **Most complete module** | — | Full ticket lifecycle, labor/cost tracking, analytics, board reports, PM schedules, QA approval |
| **QA approval workflow** | Low | Permission exists but no state machine ensures proper transitions |
| **No work order printing** | Low | No print-friendly view for work orders |

---

## 10. IT Help Desk Module

| Gap | Severity | Detail |
|-----|----------|--------|
| **Well-implemented** | — | Ticket lifecycle, comments, magic links, device management, deployment batches |
| **Device lifecycle state machine** | Medium | Batch processing structure exists but no formal workflow engine |
| **Provisioning automation** | Medium | `ITProvisioningEvent` model exists but automation engine is minimal |

---

## 11. Athletics Module

| Gap | Severity | Detail |
|-----|----------|--------|
| **Good coverage** | — | Sports, seasons, teams, games, practices, tournaments, stats, standings |
| **No roster import** | Low | No CSV import for player rosters |
| **No public schedule widget** | Low | Public pages exist but no embeddable widget for school websites |

---

## 12. Backend Infrastructure

| Gap | Severity | Detail |
|-----|----------|--------|
| **No rate limiting** | Critical | No per-IP or per-endpoint throttling on any route |
| **No webhook signature verification** | Critical | Stripe webhook has a TODO comment; Clever/ClassLink webhooks unverified |
| **No unit tests** | High | Zero Jest/Vitest tests — only smoke tests in `scripts/` |
| **No CI/CD pipeline** | High | No GitHub Actions, no automated deployment checks |
| **No structured logging** | High | Only `console.error()` throughout — no Winston, Pino, or log levels |
| **No APM/error tracking** | High | No Sentry, DataDog, or New Relic integration |
| **No pagination on list endpoints** | High | All list queries return everything — will break at scale |
| **No async job queue** | Medium | All operations (email, AI, sync) are synchronous and can timeout |
| **No distributed cache** | Medium | 30-second in-memory permission cache only — won't work with multiple instances |
| **No file upload validation** | Medium | No file size limits or MIME type checks on image uploads |
| **No input sanitization framework** | High | Only 2 sanitization functions found — HTML fields could enable stored XSS |
| **No CORS configuration** | Medium | No explicit CORS headers set |
| **No transactional integrity** | Medium | Complex multi-model operations use sequential awaits, not DB transactions |
| **No API documentation** | Medium | No OpenAPI/Swagger spec |

---

## 13. Platform Admin

| Gap | Severity | Detail |
|-----|----------|--------|
| **Billing integration basic** | Medium | Stripe webhook exists but no usage metering or overage handling |
| **No org analytics** | Low | Platform admin can see orgs but no usage metrics per org |
| **No feature flag system** | Low | `TenantModule` exists for module gating but no granular feature flags |

---

## Priority Roadmap

### Tier 1 — Ship Blockers (Do Before Launch)
1. **Forgot Password flow** — users will get locked out without this
2. **Rate limiting** on login and public endpoints
3. **Privacy Policy and Terms of Service** pages — legal requirement for schools
4. **Webhook signature verification** — security vulnerability
5. **Pricing page** — prospects need to know cost
6. **Email verification** on signup

### Tier 2 — Critical Quality (Do Within First Month)
1. **Unit tests + CI/CD pipeline** — prevent regressions
2. **Structured logging + error tracking** (Sentry or similar)
3. **Pagination** on all list endpoints
4. **Input sanitization** framework for XSS prevention
5. **JWT in httpOnly cookies** instead of localStorage
6. **Inventory system** — currently 95% unfinished
7. **Draft Events API routes** — missing individual CRUD
8. **Billing UI** for organizations to manage their own plan
9. **Audit log viewer** in settings

### Tier 3 — Polish & Scale (Ongoing)
1. Notification preferences per user
2. Bulk user import (CSV)
3. Data export (CSV/Excel)
4. 2FA / MFA support
5. OAuth integration (Google/Microsoft login)
6. Session management UI
7. Async job queue for email/AI/sync
8. Distributed cache (Redis)
9. API documentation (OpenAPI)
10. Room/resource conflict detection in calendar

---

*This analysis covers 66+ models, 281 API routes, 128 API groups, 9 settings tabs, and every user-facing page in the Lionheart Platform.*
