# Lionheart Platform — Industry Standard Checklist

> Gap analysis and roadmap to make Lionheart an industry-leading school operations platform.

---

## Executive Summary

**Current strengths:** Multi-tenant SaaS foundation, Google OAuth, setup wizard, subdomain branding, tiered modules, campus map/3D, event management, IT/Facilities ticketing UI, forms builder, AI features, water/pond module, expense tracking, knowledge base.

**Main gaps:** Incomplete data persistence, no billing integration, fragmented app architecture, limited testing/observability, missing compliance and mobile features.

---

## 1. Data & Persistence

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Tickets CRUD API** | ❌ Missing | P0 | `Ticket` exists in Prisma but no `/api/tickets`; frontend uses `INITIAL_SUPPORT_REQUESTS` + React state. All ticket create/assign/update/resolve is in-memory only. |
| **Events sync to Platform** | ⚠️ Partial | P0 | Event creator saves to React state; Platform `POST /api/events` exists but Lionheart UI doesn't call it. Two sources of truth. |
| **Forms persistence** | ❌ Missing | P0 | Forms and submissions in `formsData.js` + React state. No DB, no API. |
| **Inventory persistence** | ❌ Missing | P0 | `inventoryData.js` + localStorage. No org-scoped DB. |
| **Users/Members sync** | ⚠️ Partial | P1 | Members page uses local state; Platform has User model. No sync. |
| **Teams persistence** | ❌ Missing | P1 | Teams in `teamsData.js` DEFAULT_TEAMS + local state. No DB. |
| **Event–ticket linking** | ⚠️ Partial | P1 | Event notifications create tickets in React state only; no DB link. |

### Actions
- [ ] Build `/api/tickets` (GET list, POST create, PATCH update status/assignee)
- [ ] Wire EventCreatorModal/SmartEventModal to `POST /api/events` and load events from API on app init
- [ ] Add Form + FormSubmission models and APIs; migrate forms UI to platform
- [ ] Add InventoryItem/Stock APIs (or use existing schema); sync inventory to DB
- [ ] Sync members/users from Platform; add Teams model if needed
- [ ] Link Event ↔ Ticket in DB when event creates facility/IT tickets

---

## 2. Billing & Subscription

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Stripe integration** | ❌ Placeholder | P0 | `stripeCustomerId` in schema; Settings shows "Add Payment Method" placeholder. No checkout, no webhooks. |
| **Plan enforcement** | ⚠️ Partial | P1 | `Organization.plan` exists; modules gated in UI. No hard enforcement when plan changes. |
| **Trial expiration** | ⚠️ Partial | P1 | `trialEndsAt`, `trialDaysLeft` shown. No auto-downgrade or paywall. |
| **Usage metering** | ❌ Missing | P2 | No tracking of seats, events, tickets for usage-based billing. |
| **Invoice history** | ❌ Missing | P2 | SubscriptionSettings shows mock invoice table. |

### Actions
- [ ] Implement Stripe Checkout for subscription; create Customer on org creation
- [ ] Add webhook handler for `customer.subscription.updated`, `invoice.paid`, etc.
- [ ] Enforce plan limits in middleware or API (e.g. block features when trial expired)
- [ ] Add usage metrics (optional) for enterprise tier
- [ ] Replace mock invoices with real Stripe invoice data

---

## 3. Architecture & Deployment

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Single app** | ❌ Two apps | P1 | Vite (Lionheart) on :5173 + Next.js (Platform) on :3001. CORS, separate deploys. |
| **Real-time** | ❌ Missing | P2 | No WebSockets or SSE. No live ticket/event updates. |
| **Offline / PWA** | ❌ Missing | P2 | No service worker, no offline support. |
| **CDN / Assets** | ⚠️ Unknown | P2 | Logo, images—ensure caching headers. |
| **Env validation** | ⚠️ Minimal | P2 | No strict schema for required env vars at startup. |

### Actions
- [ ] Consider merging into single Next.js app (Lionheart as app routes) or use Vite behind proxy on same origin
- [ ] Add WebSockets or polling for ticket/event updates (optional)
- [ ] Add PWA manifest + service worker for critical flows
- [ ] Document and validate env vars (e.g. zod in platform)

---

## 4. Security & Compliance

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **CORS** | ✅ Present | — | Configured in platform |
| **Auth** | ✅ Google OAuth | — | JWT in localStorage; callback flow |
| **Password auth** | ⚠️ Platform only | P1 | Next.js login page has email/password; Lionheart uses OAuth. |
| **Row-level security** | ⚠️ API-level | P1 | `withOrg` filters; no DB RLS. Ensure all queries scoped. |
| **Audit logging** | ❌ Missing | P1 | No log of who changed what (settings, roles, deletions). |
| **Data export** | ❌ Missing | P1 | No GDPR/FERPA “export my data” for schools. |
| **Data retention** | ❌ Missing | P2 | No policy for old tickets, events, logs. |
| **HTTPS / HSTS** | ⚠️ Deploy-dependent | P1 | Ensure production uses HTTPS; HSTS headers. |
| **Secrets** | ⚠️ Env-based | — | No vault; ensure no secrets in frontend bundles. |
| **FERPA / COPPA** | ⚠️ Unknown | P1 | Student data handling; age restrictions; consent flows. |

### Actions
- [ ] Add audit log table + middleware for sensitive mutations
- [ ] Implement data export (JSON/CSV) for org admin
- [ ] Document data retention and FERPA/COPPA posture
- [ ] Add rate limiting on auth and public APIs
- [ ] Ensure HTTPS and security headers in production

---

## 5. Notifications & Communication

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **In-app notifications** | ⚠️ Basic | P1 | TopBar has notifications dropdown; appears static/mock. |
| **Email** | ⚠️ Partial | P1 | Resend referenced; monthly report cron. Invite flow uses link, no email. |
| **Ticket assignment alerts** | ❌ Missing | P1 | No email/Slack when ticket assigned. |
| **Event reminders** | ❌ Missing | P2 | No reminder before event (owner, facilities, IT). |
| **Slack/Teams** | ❌ Missing | P2 | No integration for urgent alerts. |
| **SMS** | ❌ Missing | P3 | No SMS for critical (e.g. safety) alerts. |

### Actions
- [ ] Wire notifications to real data (new tickets, assignments, approvals)
- [ ] Send email on ticket assignment, event approval, invite
- [ ] Add optional Slack webhook for critical alerts
- [ ] Event reminder job (e.g. 24h before)

---

## 6. Mobile & Accessibility

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Responsive layout** | ⚠️ Partial | P1 | Tailwind; some modals may not be mobile-optimized. |
| **Touch targets** | ⚠️ Unknown | P1 | Ensure 44px minimum for interactive elements. |
| **Screen reader** | ⚠️ Unknown | P1 | No explicit aria labels, landmarks audit. |
| **Native app** | ❌ Missing | P2 | No React Native / Capacitor; web-only. |
| **Offline ticket submit** | ❌ Missing | P2 | Teachers need to submit from classroom; offline queue would help. |

### Actions
- [ ] Audit with axe or Lighthouse a11y
- [ ] Add aria-labels, roles, live regions where needed
- [ ] Test critical flows on phone (submit ticket, view calendar)
- [ ] Consider PWA + optional native wrapper for “Add to Home Screen” experience

---

## 7. Reporting & Analytics

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Dashboard metrics** | ⚠️ Basic | P1 | Trial banner, to-do widget. No SLA, response time, backlog. |
| **Ticket analytics** | ❌ Missing | P1 | No charts: resolution time, by category, by assignee. |
| **Event analytics** | ❌ Missing | P2 | No report on room utilization, facility load. |
| **Expense reporting** | ⚠️ Data exists | P2 | Expenses in DB; no dashboard or export. |
| **Export** | ❌ Missing | P1 | No CSV/PDF export for tickets, events, members. |
| **Scheduled reports** | ⚠️ Partial | P2 | Monthly report cron exists; no configurable schedules. |

### Actions
- [ ] Build tickets dashboard: open/closed, avg resolution time, by category
- [ ] Add export for tickets, events, members (CSV, optional PDF)
- [ ] Expense summary by vendor, category, date range
- [ ] Configurable email reports (weekly digest, etc.)

---

## 8. Integrations

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Google Calendar** | ⚠️ iCal only | P1 | Fetch from SchoolDude-style feed; no Calendar API sync. |
| **SIS (PowerSchool, etc.)** | ❌ Missing | P1 | No roster, schedule, or room sync from SIS. |
| **SSO (SAML/OIDC)** | ❌ Missing | P1 | Google only; no ADFS, Okta, Clever. |
| **SchoolDude / FM** | ⚠️ iCal import | P2 | One-way; no bidirectional. |
| **Zendesk / Freshdesk** | ❌ Missing | P3 | No ticketing system sync. |

### Actions
- [ ] Add Google Calendar API sync (optional) for events
- [ ] Design SIS integration (CSV import or API) for users/rooms
- [ ] Add SAML/OIDC for district SSO
- [ ] Document iCal feed requirements for FM tools

---

## 9. Testing & Quality

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Unit tests** | ❌ Missing | P1 | No Jest/Vitest. |
| **API tests** | ❌ Missing | P1 | No integration tests for routes. |
| **E2E tests** | ❌ Missing | P1 | No Playwright/Cypress. |
| **Error boundaries** | ❌ Missing | P1 | No React error boundary; uncaught errors crash app. |
| **Monitoring** | ❌ Missing | P1 | No Sentry, LogRocket, or APM. |
| **Logging** | ⚠️ console | P2 | No structured logs, no log aggregation. |

### Actions
- [ ] Add Vitest; unit test teamsData, parseMembersCsv, eventNotifications
- [ ] Add API integration tests (tickets, events, auth)
- [ ] Add Playwright E2E for login, create ticket, create event
- [ ] Add React error boundary + fallback UI
- [ ] Integrate Sentry (or similar) for errors
- [ ] Structured logging (pino/winston) + export to CloudWatch/Datadog

---

## 10. Documentation & DX

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **API docs** | ❌ Missing | P1 | No OpenAPI/Swagger. |
| **User guide** | ❌ Missing | P1 | No in-app help or KB. |
| **Admin guide** | ⚠️ Docs folder | P2 | TIERED_PACKAGING, SETUP_FROM_SCRATCH, etc. |
| **Onboarding tour** | ⚠️ Modal | P2 | OnboardingModal + checklist; could be more guided. |
| **Changelog** | ❌ Missing | P2 | No product changelog. |
| **Runbooks** | ❌ Missing | P2 | No ops runbooks for incidents. |

### Actions
- [ ] Generate OpenAPI from Next.js routes (or hand-maintain)
- [ ] Add in-app help (?) and link to docs
- [ ] Improve onboarding checklist with deep links
- [ ] Publish changelog (e.g. GitHub Releases)
- [ ] Add runbooks for common failures (DB, Stripe, OAuth)

---

## 11. Product Features (School-Specific)

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Room booking** | ⚠️ Events | P1 | Events have roomId; no explicit booking/availability view. |
| **Conflict detection** | ✅ Exists | — | `/api/events/conflicts` |
| **Work orders** | ⚠️ Tickets | P1 | Tickets are work orders; may need more fields (recurrence, SLA). |
| **Preventive maintenance** | ❌ Missing | P1 | No recurring/scheduled maintenance tasks. |
| **Asset management** | ⚠️ Inventory | P2 | Inventory items; no serial numbers, warranty, lifecycle. |
| **Vendor management** | ❌ Missing | P2 | Expenses have vendor string; no vendor DB. |
| **Budget tracking** | ⚠️ Schema | P2 | Budget model exists; no UI. |
| **Safety mode** | ⚠️ UI | P2 | SafetyModeOverlay; unclear if integrated with drills/incidents. |
| **Multi-building** | ✅ Schema | — | Buildings, Rooms. |
| **Subdomain branding** | ✅ Done | — | Login, setup. |
| **Domain-based join** | ✅ Done | — | allowedDomains in settings. |

### Actions
- [ ] Room availability calendar (which rooms free when)
- [ ] Recurring work orders / preventive maintenance
- [ ] Asset registry (serial, warranty, location)
- [ ] Vendor table + link expenses
- [ ] Budget UI (by category, YTD)
- [ ] Safety drill/incident workflow

---

## 12. Prioritized Roadmap (Suggested Order)

### Phase 1: Core persistence (4–6 weeks)
1. Tickets API + wire frontend
2. Events sync (create/load from Platform)
3. Forms + submissions persistence
4. Basic error boundary + Sentry

### Phase 2: Billing & compliance (3–4 weeks)
5. Stripe Checkout + webhooks
6. Audit logging
7. Data export
8. Rate limiting

### Phase 3: Notifications & reporting (2–3 weeks)
9. Email for assignments, approvals, invites
10. Ticket analytics dashboard
11. Export (CSV) for tickets, events, members

### Phase 4: Integrations & scale (4–6 weeks)
12. SSO (SAML/OIDC)
13. SIS import (CSV or API)
14. Google Calendar sync (optional)
15. Consolidate to single app (optional)

### Phase 5: Polish (ongoing)
16. E2E tests
17. API docs
18. In-app help
19. Mobile optimization

---

## Quick Reference: What You Have vs. Need

| Area | Have | Need |
|------|------|------|
| **Auth** | Google OAuth, JWT, domain join | SSO, MFA, session management |
| **Tickets** | UI, schema | API, persistence, notifications |
| **Events** | UI, Platform API | Frontend sync, calendar import |
| **Forms** | Builder, submissions | Persistence, templates |
| **Inventory** | UI, schema | API, shortage alerts |
| **Billing** | Schema | Stripe, webhooks, enforcement |
| **Testing** | — | Unit, API, E2E |
| **Monitoring** | — | Error tracking, APM |
| **Docs** | Internal docs | API docs, user guide |

---

*Last updated: Feb 2025*
