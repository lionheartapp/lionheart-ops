---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Launch Readiness
status: planning
stopped_at: Phase 12 context gathered
last_updated: "2026-03-10T23:34:36.772Z"
last_activity: 2026-03-08 — Roadmap created, v2.0 phases 8-13 defined
progress:
  total_phases: 13
  completed_phases: 11
  total_plans: 37
  completed_plans: 37
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Schools can manage their entire operational workflow in one unified platform with role-based access, multi-campus support, and AI-assisted features.
**Current focus:** Phase 8 — Auth Hardening and Security (ready to plan)

## Current Position

Phase: 8 of 13 (Auth Hardening and Security)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-08 — Roadmap created, v2.0 phases 8-13 defined

Progress: [░░░░░░░░░░] 0% (v2.0 milestone)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 21
- Average duration: ~12min/plan
- Total execution time: ~4.5 hours

**By Phase (v1.0 reference):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~9min | ~4.5min |
| 02-core-tickets | 4 | ~48min | ~12min |
| 03-kanban-ai | 2 | ~43min | ~21.5min |
| 04-assets-qr-pm | 5 | ~104min | ~21min |
| 05-analytics | 2 | ~17min | ~8.5min |
| 06-compliance | 3 | ~30min | ~10min |
| 07-knowledge-base | 3 | ~24min | ~8min |

**v2.0 velocity:** No data yet (0 plans completed)
| Phase 08-auth-hardening-and-security P02 | 2 | 2 tasks | 3 files |
| Phase 08 P04 | 214 | 3 tasks | 13 files |
| Phase 08-auth-hardening-and-security P01 | 5 | 2 tasks | 9 files |
| Phase 08-auth-hardening-and-security P03 | 5 | 2 tasks | 11 files |
| Phase 08-auth-hardening-and-security P05 | 349 | 2 tasks | 14 files |
| Phase 08-auth-hardening-and-security P06 | 3 | 1 tasks | 2 files |
| Phase 08-auth-hardening-and-security P07 | 2 | 2 tasks | 4 files |
| Phase 09-marketing-and-legal-pages P01 | 4 | 2 tasks | 4 files |
| Phase 09-marketing-and-legal-pages P02 | 4 | 1 tasks | 3 files |
| Phase 09-marketing-and-legal-pages P03 | 4 | 2 tasks | 6 files |
| Phase 10-inventory-system P01 | 12 | 2 tasks | 5 files |
| Phase 10-inventory-system P02 | 4 | 2 tasks | 8 files |
| Phase 10-inventory-system P03 | 3 | 1 tasks | 1 files |
| Phase 11-calendar-ticket-and-feature-gaps P02 | 3 | 2 tasks | 8 files |
| Phase 11-calendar-ticket-and-feature-gaps P01 | 18 | 2 tasks | 5 files |
| Phase 11-calendar-ticket-and-feature-gaps P03 | 59 | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0]: Tier 1 + Tier 2 gaps in scope; Tier 3 deferred to v2.1
- [v2.0]: httpOnly cookies to replace localStorage JWT — must not break existing sessions
- [v2.0]: Vitest for unit tests, Pino for logging, Sentry for error tracking
- [v2.0]: Phase 8 (auth) must complete before phases 9-13 extend API surface
- [Phase 08-auth-hardening-and-security]: In-memory rate limiter for single-process Vercel deployments; Redis deferred to v2.1 for horizontal scaling
- [Phase 08-auth-hardening-and-security]: Login rate limiter placed in route handler (not middleware) to enable reset-on-success behavior
- [Phase 08]: Regex-based HTML sanitizer (no DOMPurify) for server-side XSS defense — avoids DOM shim dependency
- [Phase 08]: Clever/ClassLink webhooks: graceful degradation when secret unconfigured; Stripe: hard 500 (required prod config)
- [Phase 08-auth-hardening-and-security]: forgot-password always returns generic success message to prevent email enumeration
- [Phase 08-auth-hardening-and-security]: PasswordSetupToken.type field (default 'setup') allows same model to handle setup, reset, and future verification tokens
- [Phase 08-auth-hardening-and-security]: reset-password returns same response shape as login endpoint for client auto-login compatibility
- [Phase 08-auth-hardening-and-security]: isPublicPath now lists specific auth routes instead of blanket /api/auth/ — /api/auth/me and /api/auth/logout are protected; NextAuth OAuth callback URLs kept public explicitly
- [Phase 08-auth-hardening-and-security]: CSRF validation skips when csrf-token cookie is absent — preserves backward compatibility for existing localStorage sessions during migration grace period
- [Phase 08-auth-hardening-and-security]: useAuth.token returns null always — JWT in httpOnly cookie not accessible to JS; pages using direct localStorage reads continue working via Authorization header fallback in middleware
- [Phase 08-auth-hardening-and-security]: Verification link points to /api/auth/verify-email (server redirect) so cookie is set server-side before redirecting to dashboard
- [Phase 08-auth-hardening-and-security]: Login EMAIL_NOT_VERIFIED check occurs after credential validation to prevent enumeration of unverified accounts
- [Phase 08-auth-hardening-and-security]: Resend rate limit uses PasswordSetupToken.createdAt count (3/hour) — no additional table needed
- [Phase 08-auth-hardening-and-security]: Confirm password field stays as raw input — rule indicators only needed on the primary password field where user creates their new password
- [Phase 08-auth-hardening-and-security]: CSRF validation reordered to before directOrgId shortcut in middleware — no shortcut path can skip CSRF, closing AUTH-05
- [Phase 08-auth-hardening-and-security]: Client components use getAuthHeaders()/fetchApi() from api-client — no direct localStorage reads or manual x-org-id headers
- [Phase 09-marketing-and-legal-pages]: PublicNav and PublicFooter created as new components; landing page page.tsx left unchanged to avoid regression risk
- [Phase 09-marketing-and-legal-pages]: Privacy and Terms pages are Server Components (no use client) — pure content with no interactivity needed
- [Phase 09-marketing-and-legal-pages]: Legal footer links use real paths: /privacy, /terms, /pricing, /about — no placeholder # hrefs
- [Phase 09-marketing-and-legal-pages]: Client+server layout split for pricing page — client component for toggle state, server layout.tsx for SEO metadata
- [Phase 09-marketing-and-legal-pages]: sendContactFormEmail added as exported function in emailService.ts (Resend+SMTP fallback) for contact form delivery
- [Phase 09-marketing-and-legal-pages]: About page uses use client for form state machine; layout.tsx handles server-side SEO metadata
- [Phase 10-inventory-system]: InventoryTransaction quantity is signed (negative for CHECKOUT, positive for CHECKIN) - single field encodes direction
- [Phase 10-inventory-system]: InventoryTransaction not soft-deleted - transactions are immutable audit records
- [Phase 10-inventory-system]: INVENTORY_CHECKOUT and INVENTORY_CHECKIN assigned to ADMIN and MEMBER roles - staff need checkout capability without full management rights
- [Phase 10-inventory-system]: Checkin route [id] param unused (service resolves item via transactionId in body) — kept for REST URL consistency
- [Phase 10-inventory-system]: Inventory nav item not permission-gated — INVENTORY_READ on all viewer/member/admin roles, matches Dashboard/Calendar navItems behavior
- [Phase 10-inventory-system]: Smoke test dual auth: Set-Cookie header preferred over Bearer token — compatible with pre- and post-phase-08 auth migration states
- [Phase 10-inventory-system]: Inline query key factory in page.tsx — inventory is leaf feature, no cross-page sharing needed
- [Phase 10-inventory-system]: Checkout form expands inline within detail drawer via AnimatePresence — avoids nested drawer UX
- [Phase 10-inventory-system]: Co-located sub-components in inventory page.tsx — self-contained feature, no premature extraction
- [Phase 11-calendar-ticket-and-feature-gaps]: TicketComment/TicketAttachment not org-scoped in db extension — security via parent Ticket; sub-resource routes guard access via getTicketById
- [Phase 11-calendar-ticket-and-feature-gaps]: ticket-attachments Supabase bucket created as public; base64 JSON body used for attachment uploads; search uses nested AND/OR to compose with access-control
- [Phase 11-calendar-ticket-and-feature-gaps]: checkRoomConflict exported from eventService for reuse in draftEventService; ROOM_CONFLICT error uses .code property for semantic 409 catch in route handlers; smoke tests use DIRECT_URL to avoid pgbouncer prepared statement conflicts
- [Phase Phase 11]: Edit form inline in dashboard drawer (not separate route) — avoids navigation for simple field edits; handleSaveEdit uses fetchTickets() callback since dashboard has no TanStack Query client

### Pending Todos

None yet.

### Blockers/Concerns

- Auth migration (localStorage → httpOnly cookies) must not break existing sessions — needs graceful migration in phase 8
- Privacy Policy / Terms of Service content needs legal review — placeholder text initially acceptable
- Inventory system is 95% unfinished — largest single feature; plan 10-01 carries the most schema risk
- Pagination retrofit in phase 13 requires careful prioritization across 281 routes

## Session Continuity

Last session: 2026-03-10T23:34:36.767Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-settings-and-admin-tools/12-CONTEXT.md
