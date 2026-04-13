---
aliases: [API, Routes, Endpoints]
tags: [architecture, api, backend]
created: 2026-04-08
---

# API Route Inventory (406 routes)

> Last updated: 2026-03-31. Check actual files if unsure.
> Auth = requires getUserContext/getOrgIdFromRequest. Public = no auth needed.

## Route Counts by Area

| Area | Count | Base Path |
|------|-------|-----------|
| Auth | 16 | `/api/auth/` |
| Organizations/Onboarding | 8 | `/api/organizations/`, `/api/onboarding/` |
| Settings | 37 | `/api/settings/` |
| Calendar & Resources | 17 | `/api/calendars/`, `/api/calendar-events/`, `/api/resource-requests/` |
| Events (legacy + projects) | 69 | `/api/events/`, `/api/draft-events/` |
| Planning Seasons | 11 | `/api/planning-seasons/` |
| Maintenance | 40 | `/api/maintenance/`, `/api/tickets/` |
| [[IT Help Desk]] | 82 | `/api/it/` |
| Athletics | 24 | `/api/athletics/`, `/api/public/athletics/` |
| Academic Calendar | 9 | `/api/academic/` |
| [[AI Services|AI]] | 9 | `/api/ai/`, `/api/conversations/` |
| Notifications | 5 | `/api/notifications/`, `/api/user/notification-preferences/` |
| Integrations | 9 | `/api/integrations/` |
| Inventory | 5 | `/api/inventory/` |
| Platform Admin | 17 | `/api/platform/` |
| Cron | 7 | `/api/cron/` |
| Other | 11 | various |

## Auth (16 routes)

- `POST /api/auth/login` — Public. Issue JWT
- `POST /api/auth/logout` — Public. Clear cookie
- `POST /api/auth/set-password` — Public. Set password from setup token
- `GET /api/auth/set-password/validate` — Public. Validate setup token
- `POST /api/auth/forgot-password` — Public. Send reset email
- `POST /api/auth/reset-password` — Public. Reset via token
- `GET /api/auth/verify-email` — Public. Verify email from link
- `POST /api/auth/resend-verification` — Public. Resend verification
- `POST|DELETE /api/auth/impersonate` — Platform admin impersonation
- `GET /api/auth/me` — Current user identity
- `GET /api/auth/me/campuses` — Auth. User's campuses
- `GET /api/auth/permissions` — Auth. User's permissions
- `PATCH /api/auth/profile` — Update profile fields
- `PATCH /api/auth/profile/avatar` — Upload avatar
- `PATCH /api/auth/profile/password` — Change password
- `GET|POST /api/auth/[...nextauth]` — NextAuth catch-all

## Organizations / Onboarding (8)

- `POST /api/organizations/signup` — Public. Create org + admin
- `GET /api/organizations/slug-check` — Public. Check slug availability
- `GET /api/branding` — Public. Org branding by subdomain
- `POST /api/onboarding/finalize` — Finalize onboarding
- `POST /api/onboarding/import-members` — Bulk import
- `GET|PATCH /api/onboarding/school-info` — School info during onboarding
- `POST /api/onboarding/school-lookup` — [[AI Services|AI]] school data lookup
- `POST /api/onboarding/validate-address` — Validate address

## Settings (37)

**Users/Roles/Teams:**
- `GET|POST /api/settings/users` — List/invite members
- `GET|PATCH|DELETE /api/settings/users/[id]` — Member CRUD
- `GET|PUT /api/settings/users/[id]/permissions` — Per-user permission overrides
- `GET|POST /api/settings/roles` — List/create roles
- `GET|PATCH|DELETE /api/settings/roles/[id]` — Role CRUD
- `GET /api/settings/permissions` — List all permissions
- `GET|POST /api/settings/teams` — List/create teams
- `GET|PATCH|DELETE /api/settings/teams/[id]` — Team CRUD

**Organization:**
- `GET|PATCH /api/settings/organization` — Org settings
- `GET|PATCH /api/settings/school-info` — School info
- `GET|POST /api/settings/schools` + `PATCH|DELETE .../[id]` — Multi-school CRUD
- `GET|POST /api/settings/principals` + `PATCH .../[id]` — Principal CRUD
- `POST|DELETE /api/settings/branding/upload` — Logo/branding images
- `GET|PUT /api/settings/approval-config` — Event approval workflow
- `GET /api/settings/audit-logs` — Audit log viewer

**Campus (15 routes):**
- `GET /api/settings/campus` — Full campus tree
- CRUD for: `campuses`, `buildings`, `areas`, `rooms`, `assignments`
- `POST .../buildings/[id]/detect-outline` — [[AI Services|AI]] building detection
- `POST|DELETE .../images` — Campus map images
- `GET|PATCH .../map-data` — Map overlay data

**Billing/Export:**
- `GET /api/settings/billing` + `change-plan`, `invoices`, `portal`
- `GET /api/settings/export/events|tickets|users` — CSV exports

## Calendar (17)

- `GET|POST /api/calendars` + `GET|PUT .../[id]` — Calendar CRUD
- `GET /api/calendars/[id]/feed` — Public iCal feed
- `GET|POST /api/calendar-categories` — Category CRUD
- `GET|POST /api/calendar-events` + `GET|PUT .../[id]` — Event CRUD
- `.../[id]/approve|reject|submit` — Approval workflow
- `.../[id]/attendees` — Add/remove attendees
- `.../[id]/resources` — Resource bookings
- `.../[id]/rsvp` — RSVP status
- `GET /api/calendar/people-search` — Attendee picker search
- `GET /api/calendar/user-schedule` — User's schedule
- `GET|POST /api/resource-requests` + `GET|PUT .../[id]` — Resource requests

## Events (69)

**Legacy:** `GET|POST /api/events`, `GET|POST /api/draft-events`, `GET|POST /api/events/series`
**Templates:** `GET|POST /api/events/templates` + `.../[id]`
**Dashboard:** `GET|POST /api/events/dashboard`, `POST /api/events/from-submission`

**Event Projects (main):**
- `GET|POST /api/events/projects` + `GET|PATCH .../[id]`
- `.../approve`, `.../approve-gate`, `.../reject-gate`, `.../resubmit`
- `.../my-permissions`, `.../presence`, `.../activity`, `.../activities`
- `.../announcements`, `.../share`
- `GET /api/events/projects/pending-gates` — All pending approvals

**Schedule (9):** blocks CRUD, reorder, PCO sync, sections CRUD
**Tasks (2):** `GET|POST .../tasks`, `PATCH|DELETE .../tasks/[taskId]`
**Team (2):** `GET|POST .../team`, `PATCH|DELETE .../team/[memberId]`
**Budget (5):** lines CRUD, receipt upload, report, revenue
**Registration (14):** form config, registrations, medical, check-in, public registration + payment + upload, registrant portal + magic links
**Documents (3):** documents, completions, reminders
**Compliance (1):** event compliance checklist
**Groups (3):** groups CRUD, assignments, auto-assign
**Surveys (2):** surveys CRUD, responses
**Incidents (2):** incident CRUD
**Notifications (4):** rules CRUD, approve, [[AI Services|AI]] draft
**AI (9):** analyze-feedback, create-from-description, detect-conflicts, enhance-template, estimate-budget, generate-form/groups/schedule/summary

## Planning Seasons (11)

- `GET|POST /api/planning-seasons` + `GET|PUT .../[id]`
- `.../blackout-dates`, `.../conflicts`, `.../phase`, `.../publish`
- `.../submissions` CRUD + `.../submit`, `.../review`, `.../comments`

## Maintenance (40)

**Tickets (22):** CRUD, status, assign, claim, activities, checklist, costs, labor, watchers, [[AI Services|AI]] diagnose/ask, upload, AI multi-issue/suggest-category
**Assets (6):** CRUD, label, QR, batch labels, upload
**Compliance (8):** domains CRUD + populate, records CRUD + generate-ticket + upload + export
**Knowledge Base (3):** list, CRUD, search
**PM Schedules (2):** list, CRUD
**Other (5):** dashboard, analytics, board-report + export, vendors

## IT Help Desk (82)

See [[IT Help Desk]] and [[MDM and Roster]] for detailed breakdowns.

**Devices (9):** CRUD, assign/unassign, history, QR, repairs, bulk-import, public lookup
**Tickets (7):** CRUD, public submission, assign, status, public status, comments
**Students (7):** CRUD, audit, admin password gen, self-service lookup/request/reset
**Loaners (4):** list, checkout, checkin, overdue
**Damage/Reports (8):** default fees, export, summary, annual report, damage fees, custom export, forecast, repair-replace, ticket ROI
**Board (1):** IT board data
**Deployment (6):** batch CRUD, auto-populate, devices, process item, progress
**Summer (9):** mode toggle, batch CRUD + items + complete, repair queue + status + vendor-log, staging
**AI/Intelligence (5):** diagnose device/ticket, full analysis, lemons, fleet recommendations
**MDM/Sync/Provisioning (12):** MDM config/sync/test, sync configs/jobs/google/roster, provisioning config/events/trigger/orphaned
**Content Filters (8):** config, provider config, events, disposition, 4 webhooks (Bark/GoGuardian/Lightspeed/Securly)
**E-Rate (4):** calendar + complete, documentation package, documents
**Incidents (8):** CRUD, close, evidence, notifications, responders, severity, status
**Magic Links (2):** generate, validate
**Dashboard/Config/Analytics (3):** dashboard, config, analytics + district

## Athletics (24)

Sports CRUD + stat-configs, Teams CRUD, Seasons CRUD, Games CRUD + score + stats, Practices CRUD, Roster CRUD, Standings, stat leaders, Tournaments CRUD + brackets, Calendar events view, Dashboard stats, `GET /api/public/athletics/[slug]` — Public page

See [[Completed Features#Athletics (Phases 4-6)]].

## Academic Calendar (9)

Years, terms, bell-schedules, day-schedules, special-days — all CRUD

## AI (9)

- `POST /api/ai/assistant/chat` — Main chatbot (Gemini function calling) — see [[AI Services]]
- `POST /api/ai/assistant/confirm` — Confirm AI action
- `POST /api/ai/assistant/execute-workflow` — Execute AI workflow
- `POST /api/ai/generate-description` — Event description
- `POST /api/ai/parse-event` — NL event parsing
- Conversations: list, get/delete, messages, feedback

## Notifications (5)

List, unread-count, mark-read, mark-all-read, preferences

## Integrations (9)

- `GET /api/integrations/status` — All integration statuses
- Google Calendar: auth, callback, sync on/off
- Planning Center: auth, callback, sync on/off
- Twilio: config, send SMS

## Inventory (5)

CRUD, checkin, checkout, transactions

## Platform Admin (17)

Admin auth (login, me, setup), Organizations CRUD + users, Audit logs, discount codes + redemptions, Payments, plans, subscriptions, Support tickets + messages, Stripe webhook

## Cron (7)

automations, board-report-delivery, compliance-reminders, event-notifications, it-device-tasks, it-erate-reminders, maintenance-tasks

## Webhooks (2)

ClassLink, Clever (roster sync) — see [[MDM and Roster]]

## Other

- `GET|POST /api/modules` — Toggle add-on modules (see [[Completed Features#Add-ons System]])
- `GET /api/search` — Global search (see [[Completed Features#Global Search]])
- `GET|POST /api/support-tickets/platform` + `.../[id]` — Tenant support tickets
- `GET /api/places/autocomplete` — Google Places proxy
- `GET /api/weather` — Weather widget data
- `POST /api/public/contact` — Public contact form

## Public Routes (no auth required)

Auth: login, logout, set-password, forgot/reset-password, verify-email, resend-verification, me, profile, NextAuth
Org: signup, slug-check, branding
Calendar: iCal feed
Events: public registration + payment + upload, check-in lookup, registrant portal/announcements/groups/magic-links
IT: public ticket submission, status lookup, device lookup, magic link validation
Athletics: public page by slug
Webhooks: ClassLink, Clever, content filter webhooks (4), Stripe
Contact: public contact form
Platform admin uses separate JWT (not org JWT)
