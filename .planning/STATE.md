---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Launch Readiness
status: planning
stopped_at: Completed 17-leo-memory-and-learning-05-PLAN.md
last_updated: "2026-03-12T03:57:20.787Z"
last_activity: 2026-03-08 — Roadmap created, v2.0 phases 8-13 defined
progress:
  total_phases: 17
  completed_phases: 16
  total_plans: 55
  completed_plans: 54
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
| Phase 14-ai-assistant-ux-upgrade P02 | 12 | 2 tasks | 3 files |
| Phase 14-ai-assistant-ux-upgrade P01 | 4 | 2 tasks | 7 files |
| Phase 14-ai-assistant-ux-upgrade P03 | 3 | 2 tasks | 4 files |
| Phase 14-ai-assistant-ux-upgrade P03 | 15 | 3 tasks | 4 files |
| Phase 12-settings-and-admin-tools P01 | 20 | 3 tasks | 9 files |
| Phase 12-settings-and-admin-tools P02 | 18 | 2 tasks | 7 files |
| Phase 12-settings-and-admin-tools P03 | 25 | 2 tasks | 7 files |
| Phase 13-infrastructure-and-observability P01 | 6 | 2 tasks | 8 files |
| Phase 13-infrastructure-and-observability P02 | 16 | 2 tasks | 32 files |
| Phase 13-infrastructure-and-observability P03 | 7 | 2 tasks | 14 files |
| Phase 15-auth-security-gap-closure P01 | 2 | 2 tasks | 4 files |
| Phase 16-billing-permission-observability-retrofit P01 | 3 | 2 tasks | 3 files |
| Phase 16-billing-permission-observability-retrofit P02 | 7 | 2 tasks | 21 files |
| Phase 17-leo-memory-and-learning P01 | 4 | 3 tasks | 5 files |
| Phase 17-leo-memory-and-learning P03 | 3 | 2 tasks | 7 files |
| Phase 17-leo-memory-and-learning P02 | 8 | 2 tasks | 5 files |
| Phase 17 P05 | 4 | 2 tasks | 3 files |
| Phase 17-leo-memory-and-learning P04 | 3 | 2 tasks | 4 files |

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
- [Phase 14-ai-assistant-ux-upgrade]: Room model has no capacity field -- find_available_rooms min_capacity param accepted but not applied against schema
- [Phase 14-ai-assistant-ux-upgrade]: InventoryItem uses quantityOnHand not quantity -- corrected in check_resource_availability handler
- [Phase 14-ai-assistant-ux-upgrade]: executeGetWeatherForecast uses rawPrisma (not prisma) for Organization lat/lng lookup
- [Phase 14-ai-assistant-ux-upgrade]: SSE marker extraction on completed finalText (not mid-stream) prevents partial marker false positives; rich_confirmation is a separate SSE event type not embedded in action_confirmation
- [Phase 14-ai-assistant-ux-upgrade]: approvalChannels omitted from richCard -- approval channel config not yet standardized; card renders section only when present
- [Phase 14-ai-assistant-ux-upgrade]: Dual SSE emission: action_confirmation first for backward compat, rich_confirmation overrides in ChatPanel handler
- [Phase 14-ai-assistant-ux-upgrade]: InventoryItem uses quantityOnHand not quantity -- corrected in executeCreateEventDraft resource availability lookup
- [Phase 14-ai-assistant-ux-upgrade]: Dual SSE emission: action_confirmation first for backward compat, rich_confirmation overrides in ChatPanel handler
- [Phase 14-ai-assistant-ux-upgrade]: approvalChannels omitted from richCard — approval channel config not yet standardized; card renders section only when present
- [Phase 14-ai-assistant-ux-upgrade]: InventoryItem uses quantityOnHand not quantity — corrected in executeCreateEventDraft resource availability lookup
- [Phase 12-settings-and-admin-tools]: AuditLogTab uses plain fetch (not TanStack Query) to match other Settings tab patterns
- [Phase 12-settings-and-admin-tools]: Export buttons use window.open for CSV download; tickets export uses TICKETS_READ_ALL, events uses EVENTS_READ, users uses SETTINGS_READ
- [Phase 12-settings-and-admin-tools]: Audit-logs date range filtering applied at database level (server-side) so it works across all paginated pages
- [Phase 12-settings-and-admin-tools]: Stripe graceful degradation: missing STRIPE_SECRET_KEY returns 503 SERVICE_UNAVAILABLE, not a crash — billing is optional until configured
- [Phase 12-settings-and-admin-tools]: Billing portal inline error: text-red-600 shown below button for 5 seconds when stripeCustomerId is null — visible but not alarming, does not fail silently
- [Phase 12-settings-and-admin-tools]: NotificationPreference queries use rawPrisma — model not in org-scoped whitelist in db/index.ts
- [Phase 12-settings-and-admin-tools]: Slug confirmation flow is inline expandable section (AnimatePresence) — not a modal
- [Phase 12-settings-and-admin-tools]: NOTIFICATION_TYPES exported as array from notificationService for validation in preferences API
- [Phase 13-infrastructure-and-observability]: vi.mock async factory (not __mocks__ directory) required because Vitest path alias resolution does not auto-detect __mocks__ for @/ imports
- [Phase 13-infrastructure-and-observability]: DATABASE_URL empty string in test env — all DB calls mocked via vitest-mock-extended; Docker Postgres CI services deferred to future plan
- [Phase 13-infrastructure-and-observability]: Pino child logger pattern: logger.child({ route, method }) per handler — allows filtering logs by route in production without per-call overhead
- [Phase 13-infrastructure-and-observability]: Sentry.setTag('org_id') placed after orgId extraction — scopes all Sentry errors to a specific org for multi-tenant debugging
- [Phase 13-infrastructure-and-observability]: WELCOME_LINK console.log replaced with log.info containing only userId, provisioningMode, emailSent boolean — removes PII (email, setupLink) from logs for FERPA compliance
- [Phase 13-infrastructure-and-observability]: onRequestError hook skipped — not exported in current @sentry/nextjs version; Sentry.captureException in catch blocks provides equivalent coverage
- [Phase 13-infrastructure-and-observability]: disableServerWebpackPlugin/disableClientWebpackPlugin removed from withSentryConfig — not valid in installed version; replaced with sourcemaps.disable pattern
- [Phase Phase 13-infrastructure-and-observability]: PaginationMeta extends Record<string, unknown> to satisfy ok() meta parameter type without casting at every call site
- [Phase Phase 13-infrastructure-and-observability]: createOrganization wrapped in rawPrisma.$transaction() — partial signup failures roll back atomically, no orphaned orgs/users
- [Phase Phase 13-infrastructure-and-observability]: calendar-events route uses defaultLimit=100, maxLimit=500 — date-range calendar views load all events in visible window
- [Phase 15-auth-security-gap-closure]: reset-password added to publicApiRateLimiter (30 req/min) — same limit as forgot-password and set-password, closing last unprotected public auth endpoint
- [Phase 15-auth-security-gap-closure]: Signup route sets httpOnly auth-token + csrf-token cookies on 201 response, matching login route pattern; admin.token kept in JSON body for backward compat during migration window
- [Phase 15-auth-security-gap-closure]: org-name, org-slug, user-name, user-email remain in localStorage (non-sensitive display data for onboarding); auth-token and org-id removed — JWT now lives only in httpOnly cookie
- [Phase 16-billing-permission-observability-retrofit]: SETTINGS_BILLING added to DEFAULT_ROLES.ADMIN immediately after SETTINGS_UPDATE; backfill script excludes super-admin (*:* wildcard already covers billing); scope: 'global' used matching organizationRegistrationService.ts convention
- [Phase 16-billing-permission-observability-retrofit]: auth/logout wrapped in try/catch for consistency even though cookie clearing never throws
- [Phase 16-billing-permission-observability-retrofit]: auth/me Sentry.setTag placed after claims verification using claims.organizationId, not getOrgIdFromRequest
- [Phase 16-billing-permission-observability-retrofit]: resend-verification email-not-sent downgraded from console.error to log.warn — expected degraded state, not app crash; uses reason key not email for FERPA
- [Phase 16-billing-permission-observability-retrofit]: public/contact route has no Sentry.setTag — public endpoint with no orgId available
- [Phase 17-leo-memory-and-learning]: rawPrisma used in conversationService for explicit org scoping
- [Phase 17-leo-memory-and-learning]: ConversationMessage is org-scoped but NOT soft-deleted — messages are immutable audit records
- [Phase 17-leo-memory-and-learning]: pgvector HNSW indexes created lazily on first embedding operation
- [Phase 17-leo-memory-and-learning]: Gemini text-embedding-004 at 768 dimensions (Matryoshka truncation from 3072)
- [Phase 17-leo-memory-and-learning]: recall_context uses Promise.allSettled across scopes so one failed scope does not break results from others
- [Phase 17-leo-memory-and-learning]: embedTicket/embedCalendarEvent/embedInventoryItem are sync functions with internal void async — callers never await or catch
- [Phase 17-leo-memory-and-learning]: Fire-and-forget persistence via safeAsync wrapper in chat route — streaming errors never block SSE
- [Phase 17-leo-memory-and-learning]: DELETE /api/conversations/[id] uses userId check (owner-only), not just orgId — users can only delete their own conversations
- [Phase 17-leo-memory-and-learning]: ConversationSidebar uses absolute overlay within relative panel container — works in both floating and embedded modes without breaking layout
- [Phase 17-leo-memory-and-learning]: handleSelectConversation filters tool_call/tool_result messages before rendering — only user/assistant roles render as chat bubbles
- [Phase 17-leo-memory-and-learning]: Feedback toggle: clicking active button sends score=0 to deselect — matches common rating UX conventions
- [Phase 17-leo-memory-and-learning]: Memory extraction triggers only when conversation has 5+ messages — avoids expensive Gemini calls on short exchanges
- [Phase 17-leo-memory-and-learning]: assembleContext uses Promise.allSettled across all 3 layers so a failed profile lookup does not block fact retrieval
- [Phase 17-leo-memory-and-learning]: buildPersonalizedContext caps output at 2000 chars (~500 tokens) — preserves token budget for conversation history and tools

### Pending Todos

None yet.

### Blockers/Concerns

- Auth migration (localStorage → httpOnly cookies) must not break existing sessions — needs graceful migration in phase 8
- Privacy Policy / Terms of Service content needs legal review — placeholder text initially acceptable
- Inventory system is 95% unfinished — largest single feature; plan 10-01 carries the most schema risk
- Pagination retrofit in phase 13 requires careful prioritization across 281 routes

## Session Continuity

Last session: 2026-03-12T03:57:00.153Z
Stopped at: Completed 17-leo-memory-and-learning-05-PLAN.md
Resume file: None
