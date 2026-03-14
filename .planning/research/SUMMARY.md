# Project Research Summary

**Project:** Lionheart — v3.0 Event Planning Features (EventProject)
**Domain:** K-12 Educational Event Planning Platform added to existing multi-tenant SaaS
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

Lionheart v3.0 transforms the platform from a facilities/maintenance/calendar tool into an end-to-end school event management system. The core architectural decision is to introduce an `EventProject` hub model that wraps (not replaces) the existing `CalendarEvent` — adding registration, forms, documents, groups, budget, communication, and day-of tooling without breaking any existing functionality. Research across competing platforms (Planning Center, CampDoc, CampBrain, iCampPro, Sched, RSVPify, Jumbula, Aryval, Raptor EventSafe) confirms that no single product does everything Lionheart aims to do: schools currently stitch together 4-6 separate tools to run a single camp or field trip. Planning Center for worship planning, CampDoc for medical registration, Google Forms for general registration, spreadsheets for group assignments, and Mailchimp for communications. The consolidation opportunity is real and achievable with the existing stack.

The recommended approach is a four-phase delivery: (1) EventProject foundation and navigation reorientation (staff-facing only), (2) public registration and Stripe payments (introduces the first public API surface), (3) documents, groups, communication, and day-of PWA tools, and (4) AI features, budget analytics, notification orchestration, and external integrations. This ordering is dictated by hard data dependencies — forms cannot exist without EventProject, group assignment cannot happen without registrations, offline PWA caching requires stable data models, AI features require their non-AI counterparts. The architecture is additive: all 15+ new models are org-scoped extensions of the existing Prisma pattern, and all new AI features route through the existing Gemini client.

The primary risk cluster is the introduction of public-facing pages into a previously all-authenticated SaaS. Multi-tenant isolation, FERPA/COPPA compliance, magic link security, Stripe webhook idempotency, and QR scan reliability at real-world scale are all pitfalls that must be addressed architecturally before the first public route is written — they cannot be retrofitted. A secondary risk is the form builder complexity spiral: conditional form logic must be explicitly out of scope, or it will consume the entire project. Both risks have clear prevention strategies documented in the research.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js 15, Prisma, Supabase, TanStack Query, Framer Motion, dnd-kit, Dexie/Serwist, qrcode, recharts, Zod) covers the majority of v3.0 needs without new installations. Nine new packages are required, all with verified versions and clear justification.

**New packages to install:**
- `@stripe/stripe-js@8.9.0` + `@stripe/react-stripe-js@5.6.1` — Client-side Stripe Elements for PCI-compliant payment collection. Server-side `stripe` SDK already installed. Card data never touches Lionheart servers.
- `signature_pad@5.1.3` — Canonical signature capture library. Write a thin 100-line React wrapper; avoid the unmaintained `react-signature-canvas` wrapper.
- `zustand@5.x` — Multi-step form state that survives navigation. `useState` props do not scale to 6-8 step registration forms. `persist` middleware enables draft resume.
- `react-hook-form@7.x` + `@hookform/resolvers@3.x` — Uncontrolled inputs critical for mobile performance. Per-step Zod validation before advancing.
- `@react-pdf/renderer@4.3.2` — JSX-based server-side PDF generation for bus manifests and rosters. Keep existing `jspdf` for other uses; do not replace it.
- `twilio@5.13.0` — New install; SMS for day-before reminders, day-of check-in confirmations, emergency alerts.
- `googleapis@134.x` — Google Calendar two-way sync. Existing `CalendarFeedConnection` model already in place; extend for EventProject.
- `@planningcenter/api-client` (latest) — Official Planning Center client; wrap in a module toggle since not all schools use it.
- `react-turnstile@1.1.5` — Cloudflare Turnstile CAPTCHA (free, invisible by default) for public registration forms. Not needed on authenticated routes.

**Already installed — no new package needed:**
- Real-time presence uses native SSE via Next.js Route Handlers' `ReadableStream` (no socket library; socket.io requires persistent server incompatible with Vercel serverless)
- QR generation: `qrcode@^1.5.4` (server-side SVG/PNG)
- QR scanning: `html5-qrcode@^2.3.8` (camera, dynamic import only)
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (already used in Maintenance Kanban)
- Offline: `dexie@^4.3.0` + `@serwist/next@^9.5.6` (already used in Maintenance PWA)
- Date math: `date-fns@^4.1.0` — do NOT add dayjs or moment
- Charts: `recharts@^3.7.0` (budget vs. actual, registration analytics)

**Critical version constraints:**
- `zustand@5.x` has breaking changes from v4 — new install; do not upgrade any existing installation
- `twilio@5.x` has breaking changes from v4 — new install
- `@react-pdf/renderer@4.x` requires `dynamic({ ssr: false })` in client contexts; import directly in Route Handlers

**New environment variables required:**
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_EVENTS_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `PLANNING_CENTER_APP_ID`, `PLANNING_CENTER_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

**New Supabase Storage buckets needed:**
`events/{orgId}/{eventId}/hero-image/`, `documents/`, `registrations/{regId}/photos/`, `registrations/{regId}/signatures/`, `reports/`

### Expected Features

**Must have (table stakes — users assume these exist):**
- EventProject hub page with 8 tabbed sections (Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms)
- Three entry paths: Planning Season publish, EventSeries recurring setup, direct mid-year request
- Public event page with school branding (zero Lionheart branding visible to parents)
- Registration form with common fields as toggleable presets (student name, grade, emergency contacts, dietary, allergies, medications, t-shirt size)
- Custom form fields (text, dropdown, checkbox, number, date, file upload) — no conditional logic
- Multi-page form with progress indicator (camps have 4-6 pages)
- Stripe payment collection (credit card, Apple Pay, Google Pay; deposits; payment plans; discount codes)
- E-signature capture (finger on mobile, typed name on desktop; timestamp + IP)
- Confirmation email with QR code per registration
- Magic link / code-based parent access (no Lionheart account required — ever)
- QR check-in with real-time counter (SSE) and offline validation
- Drag-and-drop group assignment (buses, cabins, small groups, activities)
- Printable bus manifests, cabin rosters, medical summaries, emergency contact sheets
- Per-participant document completion tracking with targeted reminder capability
- Targeted announcements (by group, by document status, by payment status)
- Budget line items with revenue/expense tracking (actual vs. budgeted)
- Event activity log (automatic, append-only, server-generated on every mutation)

**Should have (competitive differentiators — none exist in any competitor):**
- AI-powered event creation from natural language ("Field trip to Griffith Observatory, 45 juniors, March 12")
- AI form generation from event type and parameters
- AI initial group assignment (gender + grade + friend requests + counselor ratios as constraints)
- Notification orchestration with condition-based triggers (automatic sequence, coordinator approves before send)
- Participant personal dashboard at same URL as registration (no account, no app download)
- Offline-capable day-of tools (PWA: QR scanning, headcount, incident log with offline sync)
- Dietary and medical aggregation reports (formatted for kitchen and nurse)
- Save as Template + AI-enhanced templates with lessons learned from activity log
- Intelligent conflict detection (weather risk, SAT weekend, audience overlap beyond date/room blocking)
- Real-time collaboration with presence indicators (SSE-driven)
- Photo upload integrated across all day-of tools (visual confirmation at check-in, cabin roster photos)
- Per-participant cost analysis from budget data

**Defer to post-v3.0 (documented anti-features):**
- Conditional form logic (branching, calculated fields) — use Jotform embed as escape valve; exponential complexity
- DocuSign/HelloSign integration — built-in signature capture handles all school waivers
- Native iOS/Android app — PWA achieves 90% of the native experience without App Store gatekeeping
- SIS integration (PowerSchool, Clever, Infinite Campus) — CSV import sufficient for v3.0
- Budget integration with Munis/Tyler — PDF/CSV export satisfies 90% of the need
- Complex multi-step approval workflows — single admin gate covers 95% of schools
- Public event discovery / school-wide event calendar
- Participant-to-participant social features (COPPA risk for under-13)
- Automated payment reconciliation

### Architecture Approach

The architecture is organized into three tiers: a public tier (no auth) for registration pages, a webhook receiver, and the Stripe payment callback; an authenticated app tier (JWT + org-scoped) for the EventProject hub and all staff tooling; and a service/data tier for all business logic. A fourth offline/sync tier extends the existing Dexie IndexedDB database (version 1, currently used for Maintenance) to version 2 with event-specific object stores.

**Major components and responsibilities:**
1. **EventProject hub model** — Central entity in `prisma/schema.prisma`; connects all event records via `eventProjectId` FK. Status: DRAFT → PUBLISHED → COMPLETED → ARCHIVED. Never extends CalendarEvent directly.
2. **EventProject page** (`src/app/events/[id]/page.tsx`) — 8-tab workspace. Empty section tabs serve as built-in checklist for first-time planners.
3. **Public event page** (`src/app/events/[slug]/public/page.tsx`) — School-branded, no auth. Resolves org from URL slug via `rawPrisma.organization.findUnique({ where: { slug } })`, then `runWithOrgContext`. Rate-limited; CAPTCHA on form submission.
4. **Form builder service** — JSON schema stored as versioned JSONB column. Immutable after first submission — new submissions create a new version. Renderer self-contained (runs in public page context and PDF context).
5. **Registration service** — State machine: `PENDING_PAYMENT → PAID → CHECKED_IN → WAITLISTED / CANCELLED`. Medical fields in separate `RegistrationSensitiveData` table with distinct `events:medical:read` permission.
6. **Stripe event service** — Separate from platform billing. `/api/webhooks/stripe-events/` uses its own `STRIPE_EVENTS_WEBHOOK_SECRET`. Idempotent: persists `stripeEventId` before every handler execution.
7. **QR service** — Generates per-registration codes. Check-in validates against local IndexedDB cache (offline-first); syncs in background.
8. **Notification orchestrator** — Stores schedules as relative offsets (not absolute timestamps). Re-evaluates conditions at execution time, not enqueue time.
9. **PDF service** — Async queue pattern: request triggers background job; job uploads to Supabase Storage; client polls or receives SSE notification when ready.
10. **Offline event layer** — Extends `lionheart-offline-v1` Dexie DB to version 2 with `offlineEventRosters`, `offlineQRScans`, `offlineIncidents`.
11. **Calendar bridge** — When EventProject is published, auto-creates a `CalendarEvent` with `sourceModule='event-project'` and `sourceId=eventProject.id`. Calendar reads CalendarEvents; clicking a bridged event deep-links to `/events/[id]`.

**Key patterns derived from codebase inspection:**
- Public routes resolve orgId from URL slug via `rawPrisma`; never derive orgId from client-supplied header or query param
- All 15+ new EventProject models must be added to `orgScopedModels` in `src/lib/db/index.ts` before any route is written
- SSE via `ReadableStream` for real-time presence; heartbeat comment (`:\n\n`) every 25s; client auto-reconnects on silence for 30s
- Stripe webhook handler: `req.text()` for raw body; `stripe.webhooks.constructEvent()` before touching payload; idempotency check before any DB write
- Two separate Stripe webhook endpoints: platform billing at existing path; event payments at `/api/webhooks/stripe-events/` with its own signing secret

**Correct build order (dependency-driven):**
1. Data models (Prisma schema, orgScopedModels, permissions)
2. EventProject CRUD + hub page + navigation reorientation
3. Calendar bridge (CalendarEvent ← EventProject publish)
4. Form builder + public pages (first public API surface)
5. Registrations + Stripe payments
6. QR codes + day-of tools + offline Dexie extension
7. Groups, documents, budget, communications (parallel once hub exists)
8. Notification orchestrator
9. AI features (all require their non-AI counterpart first)
10. External integrations (Planning Center, Google Calendar, Twilio)
11. PDF generation (async queue; requires groups and registrations)

### Critical Pitfalls

1. **Public pages break multi-tenant isolation** — The most dangerous pitfall. The first public API route without slug-based org resolution can expose cross-tenant data. Prevention: create `getPublicOrgId(req, slug)` utility before any public endpoint is written; put all public routes in `/api/public/[slug]/...` namespace; never trust client-supplied `organizationId` on public routes.

2. **Stripe webhook double-processing** — Stripe retries for 72 hours. Without idempotency, a network hiccup creates duplicate registrations, double confirmation emails, and broken refund logic. Prevention: persist `stripeEventId` and check existence before every handler; keep handlers under 5 seconds; always enqueue slow work (PDF, email) rather than processing inline.

3. **Student medical data without FERPA/COPPA guardrails** — Medical fields in the same JSON blob as non-sensitive registration data become accessible to anyone with `events:read`. The 2025 COPPA amendment requires opt-in consent for data collection from participants under 13. Prevention: `RegistrationSensitiveData` table with `events:medical:read` permission; explicit parental consent gate before any personal data field is shown for under-13 participants; scheduled purge job (default 90 days post-event).

4. **CalendarEvent schema migration data loss** — This platform uses `db:push` (no migration file history on remote). A `db:push:remote` that renames a column drops and recreates it — data is gone. Prevention: expand-and-contract migration pattern (add EventProject alongside CalendarEvent; never rename or remove CalendarEvent fields); run `prisma migrate diff` before every `db:push:remote`; take a Supabase point-in-time backup before every production schema change.

5. **Notification orchestration spam on event reschedule** — Scheduling notifications as absolute timestamps means a rescheduled event fires all notifications in a burst. Prevention: store schedules as relative offsets (`-14 days`, `-7 days`); cancel all pending jobs for an event before re-enqueuing when the date changes; re-evaluate condition triggers at execution, never at enqueue.

6. **Form builder complexity spiral** — Conditional logic ("show dietary field only if attending dinner") starts small and absorbs the entire project. Prevention: lock scope to the field types in PROJECT.md before design begins; any conditional form request routes to Jotform embed.

7. **Magic link abuse and token reuse** — Forwarded links grant access to participant medical data. Prevention: single-use tokens (mark used on first click); max 48-hour token expiry; rate limit to 3 requests per email per hour; day-of check-in tokens are scope-limited and separate from registration access tokens.

8. **PWA offline conflict resolution causes data loss** — Two devices editing the same check-in status silently overwrites data. Prevention: append-only event log model for check-ins (never update, only add events); conflict badge in sync UI; snapshot group data on incidents at time of creation.

9. **PDF generation blocks serverless functions** — Synchronous `@react-pdf/renderer` in a Route Handler blocks the event loop for 3-4 seconds. Prevention: always use async queue + Supabase Storage cache; generate PDFs in background jobs; test with 200+ participant datasets before shipping.

10. **QR scanning failures at day-of scale** — Office-tested QR codes fail at 30% rate when printed on thermal paper and scanned in sunlight by volunteers. Prevention: offline-first validation (roster preloaded into IndexedDB); manual name lookup fallback; H-level error correction; minimum 2cm print size; test on physically printed labels before any event goes live.

---

## Implications for Roadmap

The feature dependency graph from FEATURES.md and the architectural build order from ARCHITECTURE.md converge on the same four-phase structure. Pitfall prevention windows add timing constraints that reinforce the phase order. All four constraints point the same direction: no single phase can be safely reordered.

### Phase 1: Event Foundation

**Rationale:** Nothing else can be built without the hub model. Navigation reorientation establishes the new information architecture. Calendar bridge ensures existing functionality survives the transition. This phase is staff-facing only — no public routes, no new security surface to manage.

**Delivers:**
- EventProject model as CalendarEvent hub (15+ new Prisma models, all added to orgScopedModels before first route)
- EventProject hub page with 8 tabbed sections (empty states are acceptable; they serve as checklist)
- Three entry paths (Planning Season publish, EventSeries recurring, direct request)
- Calendar bridge (`CalendarEvent.sourceModule = 'event-project'`)
- Navigation reorientation (Events primary in sidebar; Calendar/Planning nested)
- EventTask checklist with assignee + due date
- Event activity log (append-only, auto-generated on every mutation)
- Smart action dashboard (AI-prioritized actions across active events)
- 301 redirects for all changed URL paths before PR merges

**Features from FEATURES.md:** All Phase 1 table stakes (EventProject hub, activity log, nav reorientation, EventTask checklist, three entry paths)

**Pitfalls to avoid:**
- CalendarEvent migration data loss — expand-and-contract; `prisma migrate diff` before every `db:push:remote`
- Navigation restructuring breaks bookmarks — 301 redirects enforced before PR merges; announce 2 weeks prior
- `rawPrisma` inside route handlers — all new models in `orgScopedModels` before writing the first route

**Research flag:** Standard patterns — well-documented Prisma extension and Sidebar restructure. Skip research-phase.

---

### Phase 2: Registration and Public Pages

**Rationale:** This phase introduces the first public API routes, the first untrusted input, and the first payment processing. Multi-tenant isolation must be locked in before a single public endpoint is written. Stripe integration is high complexity and earns its own phase. FERPA/COPPA compliance must be built from the start, not retrofitted.

**Delivers:**
- Public event page with school branding (school logo, cover image, zero Lionheart branding)
- Registration Form Builder (common fields as typed columns + custom fields as JSON schema)
- Multi-page form with progress indicator
- Stripe Elements payment integration (deposits, payment plans, discount codes)
- E-signature capture (`SignaturePad.tsx` component + typed-name desktop fallback)
- Confirmation email with QR code (extends existing Resend service)
- Magic link / code-based parent access (single-use tokens, 48h expiry, rate-limited)
- Participant personal dashboard (schedule stubs, announcements, outstanding docs)
- Share/Distribution Hub (copy link, QR for flyers, branding controls, registration open/close dates)
- Registration capacity + waitlist management
- CAPTCHA on all public form submissions (Cloudflare Turnstile)
- `RegistrationSensitiveData` table with `events:medical:read` permission (medical, emergency contacts)
- COPPA consent gate for participants under 13

**Uses from STACK.md:** `@stripe/stripe-js`, `@stripe/react-stripe-js`, `signature_pad`, `zustand`, `react-hook-form`, `react-turnstile`

**Pitfalls to avoid:**
- Public pages break multi-tenant isolation — `getPublicOrgId` utility before first route is written
- Stripe webhook double-processing — `stripeEventId` idempotency before going live with real transactions
- Student medical data FERPA/COPPA — `RegistrationSensitiveData` table with separate permission from day one; under-13 consent gate in registration flow
- Magic link abuse and token reuse — single-use tokens, 48h expiry, rate limiting before launch

**Research flag:** Stripe webhook idempotency and COPPA under-13 consent implementation warrant a research spike before this phase. Both have regulatory implications if built incorrectly.

---

### Phase 3: Documents, Groups, Communication, and Day-Of Tools

**Rationale:** All features in this phase require registered participants (Phase 2 dependency). Documents need registrants to track completion for. Groups need participants to assign. Day-of PWA needs stable data models to cache. These components are parallel and independent of each other once Phase 2 models are stable.

**Delivers:**
- EventDocument model with signature capture
- Per-participant document completion tracking + targeted reminders
- EventGroup model (BUS, CABIN, SMALL_GROUP, ACTIVITY) with capacity
- Drag-and-drop group assignment UI (dnd-kit `SortableContext` with multiple containers)
- Printable bus manifests, cabin rosters, medical summaries (async PDF queue + Supabase Storage cache)
- ActivitySignup for elective schedule items with capacity
- Dietary and medical aggregation reports
- EventCommunication with audience targeting (all, group, incomplete-docs, paid-only)
- QR check-in scanning with real-time counter (SSE)
- Compliance checklist for off-campus events
- EventIncident logging (online + offline queue)
- Offline PWA day-of tools (extend Dexie to version 2 with `offlineEventRosters`, `offlineQRScans`, `offlineIncidents`)

**Uses from STACK.md:** `@dnd-kit` (already installed), `@react-pdf/renderer`, `dexie` + `@serwist/next` (already installed), `qrcode` + `html5-qrcode` (already installed)

**Pitfalls to avoid:**
- PWA offline conflict resolution — append-only event log for check-ins; conflict badge in sync UI; snapshot group data on incidents
- QR scanning failures at scale — offline-first validation; manual name lookup fallback; H-level error correction; test on printed codes
- Real-time collaboration race conditions — optimistic locking with `version` field on group assignments; 409 Conflict surfaced to user
- PDF generation blocks serverless — async queue only; test with 200-participant dataset before shipping

**Research flag:** Offline conflict resolution strategy for check-in data needs detailed design before Dexie schema version 2 is finalized. The append-only event log approach should be prototyped. Safari Background Sync absence also needs a UX design decision (given likely high iOS usage among school staff).

---

### Phase 4: AI, Budget, Notifications, and External Integrations

**Rationale:** All AI features require their non-AI counterparts to exist first — AI form generation needs the form builder; AI group assignment needs EventGroup; AI template intelligence needs completed events in the system. Budget is self-contained but lower urgency than the day-of tooling. External integrations are additive and can slip without blocking core functionality.

**Delivers:**
- EventBudgetLine model (category, budgeted, actual, INCOME/EXPENSE)
- Budget vs. actual report with per-participant cost analysis
- Notification orchestration (relative-offset timeline + condition triggers re-evaluated at execution)
- Smart Event Creation from natural language (extends Gemini service)
- AI form generation
- AI group assignment (constraints: gender, grade, friend requests, counselor ratios)
- Intelligent conflict detection (weather risk, SAT weekend, audience overlap)
- AI budget estimation from historical data
- Communication drafting with event context
- Post-event feedback surveys + AI analysis
- Save as Template / Create from Template
- AI-enhanced templates (auto-update dates, lessons learned from activity log)
- Planning Center integration (People, Check-Ins, Calendar) — module-toggled
- Google Calendar sync extension (existing `CalendarFeedConnection` — extend for EventProject)
- Twilio SMS notifications

**Uses from STACK.md:** `@google/genai` (already installed), `twilio`, `googleapis`, `@planningcenter/api-client`

**Pitfalls to avoid:**
- Notification scheduler drift — relative offsets only; cancel all pending jobs on event reschedule; re-evaluate conditions at execution
- Planning Center API rate limits — store `planningCenterId` mapping table; wrap in module toggle; graceful degradation if API unavailable
- Google Calendar two-way sync conflicts — one-way push only (Lionheart → Google); never auto-pull
- Twilio opt-out tracking — persist STOP status per phone number; check before every send

**Research flag:** Planning Center API coverage varies by subscription tier — verify available modules (People, Check-Ins, Calendar, Services) at the target school's tier before committing to scope. Google Calendar OAuth2 requires HTTPS redirect URIs; local dev needs ngrok or Vercel preview URL for callback testing.

---

### Phase Ordering Rationale

The ordering is dictated by three interlocking constraints that all point in the same direction:

1. **Hard data dependencies:** EventRegistration requires EventProject. EventGroup requires EventRegistration. AI features require their non-AI counterparts. Offline PWA caching requires stable data models. Templates require completed events. Building out of order creates orphaned systems.

2. **Security surface expansion timing:** Phase 1 is staff-only (no new security surface). Phase 2 opens the first public API surface and must have multi-tenant isolation, CAPTCHA, rate limiting, magic link security, and FERPA compliance fully in place before any parent sees the form. Phases 3 and 4 add no new public security surface. Sequencing public exposure as Phase 2 (not Phase 1) gives the data model time to stabilize.

3. **Pitfall prevention windows:** CalendarEvent migration safety must be addressed in Phase 1 before any schema change touches production. Stripe idempotency and COPPA guardrails must be addressed in Phase 2 before real payments or medical data collection. PWA conflict resolution model must be designed in Phase 3 before the Dexie schema version 2 is finalized. Notification scheduler architecture must be locked in Phase 4 before any notification type is implemented.

### Research Flags Summary

| Phase | Needs Research | Standard Pattern |
|-------|---------------|------------------|
| Phase 1 | None | Yes — standard Prisma extension + sidebar restructure |
| Phase 2 | Stripe webhook idempotency edge cases; COPPA under-13 consent implementation | No — regulatory risk if built wrong |
| Phase 3 | Offline conflict resolution strategy; Safari Background Sync fallback UX | Partial — PWA pattern established; conflict model needs design |
| Phase 4 | Planning Center API tier coverage; Google Calendar OAuth2 local dev setup | No for integrations |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 9 new packages verified via npm with exact version numbers. Rationale for rejections documented (react-beautiful-dnd, Puppeteer, Formik, socket.io, pusher). SSE pattern verified against Next.js 15 Route Handler docs. One caveat: Planning Center API client coverage is MEDIUM — official package confirmed but API tier coverage not fully verified. |
| Features | HIGH | Cross-referenced against 10+ competitor platforms. Feature phase ordering derived from hard dependency graph (FEATURES.md dependency tree), not opinion. Anti-features documented with explicit rationale to prevent scope creep. |
| Architecture | HIGH | Based on direct codebase inspection of `prisma/schema.prisma`, `src/lib/db/index.ts`, `src/middleware.ts`, `src/lib/offline/db.ts`, `src/components/Sidebar.tsx`. All integration points verified against existing code. SSE and Stripe webhook patterns cross-referenced with external sources. |
| Pitfalls | HIGH | All 12 major pitfalls sourced from multiple references (OWASP, Stripe changelog, FERPA/COPPA regulatory guidance, Prisma migration docs, LogRocket PWA research). The 2025-03-31 Stripe partial capture change is verified against the Stripe changelog. |

**Overall confidence:** HIGH

### Gaps to Address

- **Stripe Connect vs. standard Stripe:** Research assumes standard Stripe (event fees collected directly into the school's Stripe account). If the model requires Lionheart to collect fees and distribute to schools, Stripe Connect is required — a significantly different integration with its own OAuth flow. Verify the payment collection model before Phase 2 planning begins.

- **Planning Center API tier coverage:** The features available via `@planningcenter/api-client` vary by the school's Planning Center subscription. Verify which modules (People, Check-Ins, Calendar, Services) are available at the target school's tier before building integration. Wrap everything in a module toggle so missing tier coverage does not break core functionality.

- **Vercel background function availability for PDF generation:** PDF generation requires an async queue pattern. Verify whether Vercel background functions (or an alternative like Upstash/BullMQ) are available in the deployment plan. This must be resolved before Phase 3 PDF work begins.

- **Safari Background Sync on iOS:** Safari does not support the Background Sync API. Given that school staff are likely to use iOS devices, the fallback UX ("sync when online" manual button with unsynced action count badge) needs to be fully designed before Phase 3 begins. If not designed upfront, it becomes an afterthought that fails in production.

- **Magic link session duration policy:** Research recommends a 7-30 day session cookie (so parents do not re-request a magic link every visit). The exact duration should be validated against the school's IT security policy before Phase 2 ships.

- **`Organization.timezone` field:** Required for Phase 4 notification scheduling (relative offsets must compute to correct local fire times). Verify whether this field exists on the current `Organization` model. If absent, add it in Phase 1 settings — one-line schema addition, zero risk to add early.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (`prisma/schema.prisma`, `src/lib/db/index.ts`, `src/middleware.ts`, `src/lib/offline/db.ts`, `src/components/Sidebar.tsx`) — architecture patterns, existing models, org-scoping implementation
- [Stripe npm — @stripe/stripe-js@8.9.0](https://www.npmjs.com/package/@stripe/stripe-js) — version confirmed
- [Stripe npm — @stripe/react-stripe-js@5.6.1](https://www.npmjs.com/package/@stripe/react-stripe-js) — version confirmed
- [Stripe Payment Element docs](https://docs.stripe.com/payments/payment-element) — PCI compliance, integration pattern
- [Stripe Changelog 2025-03-31](https://docs.stripe.com/changelog/basil/2025-03-31/remove-refund-from-partial-capture-and-payment-cancellation-flow) — partial capture refund change verified
- [signature_pad@5.1.3 on npm](https://www.npmjs.com/package/signature_pad) — version and touch support confirmed
- [@react-pdf/renderer@4.3.2 on npm](https://www.npmjs.com/package/@react-pdf/renderer) — 860k weekly downloads; no binary dependency
- [twilio@5.13.0 on npm](https://www.npmjs.com/package/twilio) — v5 current major; breaking changes from v4
- [react-turnstile@1.1.5 on npm](https://www.npmjs.com/package/react-turnstile) — Cloudflare Turnstile free tier; invisible by default
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — tenant isolation patterns
- [FERPA Compliance Guide 2026 — UpGuard](https://www.upguard.com/blog/ferpa-compliance-guide) — FERPA requirements for event data
- [FERPA & COPPA Compliance for School AI — SchoolAI](https://schoolai.com/blog/ensuring-ferpa-coppa-compliance-school-ai-infrastructure) — COPPA 2025 amendment (opt-in vs. opt-out shift)
- [Protecting Magic Link Endpoints from Abuse — MojoAuth](https://mojoauth.com/blog/otp-magic-link-abuse-protection) — rate limiting, single-use enforcement
- [Offline-First Frontend Apps 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — Dexie + Background Sync patterns
- [Real-Time Updates with SSE in Next.js 15](https://damianhodgkiss.com/tutorials/real-time-updates-sse-nextjs) — Route Handler ReadableStream pattern
- [Planning Center API Documentation](https://developer.planning.center/docs/) — OAuth2, JSON:API, webhook HMAC-SHA256 verification

### Secondary (MEDIUM confidence)
- [googleapis on npm](https://www.npmjs.com/package/googleapis) — official Google Node.js client; OAuth2 flow complexity well-documented but local dev requires ngrok
- [@planningcenter/api-client on npm](https://www.npmjs.com/package/@planningcenter/api-client) — official client confirmed; API tier coverage varies by subscription
- [Stripe + Next.js 15 Complete Guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — `req.text()` for webhook raw body
- [Handling Payment Webhooks Reliably — Medium](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) — idempotency patterns
- Competitor research: CampDoc, CampBrain, iCampPro, CampSite, Planning Center, Sched, RSVPify, Jumbula, Aryval, Raptor EventSafe — feature parity analysis
- [Prisma Migration Strategies — Prisma Data Guide](https://www.prisma.io/dataguide/types/relational/migration-strategies) — expand-and-contract pattern
- [Handling Race Conditions in Real-Time Apps — DEV Community](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8) — optimistic locking with version field

### Tertiary (LOW confidence)
- [7 Best QR Code Libraries 2025 — qrcode.fun](https://qrcode.fun/blog/best-qr-code-libraries-2025) — `qrcode` package for server-side SVG/PNG (already installed; confirms choice)
- [Notification Fatigue — Courier Blog](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas) — notification orchestration UX patterns
- [Form Builder Build vs Buy — Joyfill](https://joyfill.io/blog/build-vs-buy-a-form-builder-for-saas-applications) — scope complexity analysis for form builders

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
