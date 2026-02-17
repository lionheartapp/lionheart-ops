# Lionheart Platform — Industry Standard Checklist

> Gap analysis and roadmap to make Lionheart an industry-leading school operations platform.

---

## Executive Summary

**Current strengths:** Single Next.js app (UI + API, same-origin), multi-tenant SaaS, Google OAuth, setup wizard, subdomain branding, tiered modules, campus map/3D, event management, IT/Facilities ticketing UI with tickets API, events API wired, forms builder, AI features, water/pond module, expense tracking, knowledge base, global error boundary.

**Main gaps:** Forms/inventory still in-memory or local; no billing integration; limited testing/observability; missing compliance and mobile features.

---

## 1. Data & Persistence

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **Tickets CRUD API** | ✅ Done | — | `GET/POST /api/tickets`, `PATCH /api/tickets/[ticketId]`; frontend uses `platformFetch` to load and mutate. Persisted per org. |
| **Events sync** | ✅ Wired | P0 | Dashboard loads events from `/api/events`; EventCreatorModal/SmartEventModal call `POST /api/events`. Single source of truth. |
| **Forms persistence** | ✅ Done | — | Form + FormSubmission APIs; dashboard loads/saves forms and submissions per org. |
| **Inventory persistence** | ❌ Missing | P0 | `inventoryData.js` + localStorage. Schema exists; no org-scoped API. |
| **Users/Members sync** | ⚠️ Partial | P1 | Members page uses local state; User model and `/api/user/me` exist. No full members list API or sync. |
| **Teams persistence** | ❌ Missing | P1 | Teams in `teamsData.js` DEFAULT_TEAMS + local state. No DB. |
| **Event–ticket linking** | ⚠️ Partial | P1 | Event notifications can create tickets via API; ensure event↔ticket link in DB where needed. |

### Actions
- [x] ~~Add Form + FormSubmission models and APIs; migrate forms UI to use them~~ (done)
- [ ] Add InventoryItem/Stock APIs (schema exists); sync inventory to DB, remove localStorage
- [ ] Expose members list API; sync members/users from Platform in UI
- [ ] Add Teams model and API if needed; replace DEFAULT_TEAMS with DB
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
| **Single app** | ✅ Done | — | One Next.js app at root: dashboard at `/app`, API at `/api`, same-origin. No CORS for app; single deploy (e.g. app.lionheartapp.com). |
| **Real-time** | ❌ Missing | P2 | No WebSockets or SSE. No live ticket/event updates. |
| **Offline / PWA** | ❌ Missing | P2 | No service worker, no offline support. |
| **CDN / Assets** | ⚠️ Unknown | P2 | Logo, images—ensure caching headers. |
| **Env validation** | ⚠️ Minimal | P2 | No strict schema for required env vars at startup. |

### Actions
- [ ] Add WebSockets or polling for ticket/event updates (optional)
- [ ] Add PWA manifest + service worker for critical flows
- [ ] Document and validate env vars (e.g. zod at startup)

---

## 4. Security & Compliance

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **CORS** | ✅ Present | — | Configured for `/api/*` where needed. |
| **Auth** | ✅ Google OAuth | — | JWT in localStorage; callback flow; same-origin API. |
| **Password auth** | ⚠️ Present | — | Login page has email/password; OAuth also available. |
| **Row-level security** | ⚠️ API-level | P1 | `withOrg`-style filters; no DB RLS. Ensure all queries org-scoped. |
| **Audit logging** | ⚠️ Schema | P1 | AuditLog model exists; no middleware or UI. |
| **Data export** | ❌ Missing | P1 | No GDPR/FERPA “export my data” for schools. |
| **Data retention** | ❌ Missing | P2 | No policy for old tickets, events, logs. |
| **HTTPS / HSTS** | ⚠️ Deploy-dependent | P1 | Ensure production uses HTTPS; HSTS headers. |
| **Secrets** | ⚠️ Env-based | — | No vault; ensure no secrets in frontend bundles. |
| **FERPA / COPPA** | ⚠️ Unknown | P1 | Student data handling; age restrictions; consent flows. |

### Actions
- [ ] Add audit middleware and UI for sensitive mutations (AuditLog)
- [ ] Implement data export (JSON/CSV) for org admin
- [ ] Document data retention and FERPA/COPPA posture
- [ ] Add rate limiting on auth and public APIs
- [ ] Ensure HTTPS and security headers in production

---

## 5. Notifications & Communication

| Item | Status | Priority | Notes |
|------|--------|----------|-------|
| **In-app notifications** | ⚠️ Basic | P1 | TopBar has notifications dropdown; may be static/mock. |
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
| **Error boundaries** | ✅ Present | — | GlobalErrorBoundary wraps dashboard; WidgetErrorBoundary for widgets. |
| **Monitoring** | ⚠️ Stub | P1 | Instrument stub (no-op); no Sentry/LogRocket/APM. |
| **Logging** | ⚠️ console | P2 | No structured logs, no log aggregation. |

### Actions
- [ ] Add Vitest; unit test teamsData, parseMembersCsv, eventNotifications
- [ ] Add API integration tests (tickets, events, auth)
- [ ] Add Playwright E2E for login, create ticket, create event
- [ ] Integrate Sentry (or similar) for errors (replace stub in instrument.js)
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

### Phase 1: Remaining core persistence (2–3 weeks)
1. ~~Forms + submissions persistence~~ (done)
2. Inventory APIs + DB sync (replace localStorage)
3. Replace Sentry stub with real error tracking

### Phase 2: Billing & compliance (3–4 weeks)
4. Stripe Checkout + webhooks
5. Audit logging (middleware + UI)
6. Data export
7. Rate limiting

### Phase 3: Notifications & reporting (2–3 weeks)
8. Email for assignments, approvals, invites
9. Ticket analytics dashboard
10. Export (CSV) for tickets, events, members

### Phase 4: Integrations & scale (4–6 weeks)
11. SSO (SAML/OIDC)
12. SIS import (CSV or API)
13. Google Calendar sync (optional)
14. Real-time updates (WebSockets or polling, optional)

### Phase 5: Polish (ongoing)
15. E2E tests
16. API docs
17. In-app help
18. Mobile optimization

---

## Quick Reference: What You Have vs. Need

| Area | Have | Need |
|------|------|------|
| **Architecture** | Single Next.js app, same-origin API | Real-time, PWA optional |
| **Auth** | Google OAuth, JWT, domain join | SSO, MFA, session management |
| **Tickets** | API + UI, persistence | Notifications, analytics |
| **Events** | API + UI, persistence | Calendar import, reminders |
| **Forms** | Builder, submissions UI, API + DB | Templates, export |
| **Inventory** | UI, schema | API, persistence, shortage alerts |
| **Billing** | Schema | Stripe, webhooks, enforcement |
| **Testing** | Error boundaries | Unit, API, E2E |
| **Monitoring** | Stub | Sentry/APM |
| **Docs** | Internal docs | API docs, user guide |

---

*Last updated: Feb 2026*
