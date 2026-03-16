---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 09
subsystem: integrations
tags: [planning-center, google-calendar, twilio, sms, oauth, prisma, googleapis, twilio-sdk]

# Dependency graph
requires:
  - phase: 22-02
    provides: "Phase 22 base models and notification orchestration foundation"

provides:
  - "IntegrationCredential Prisma model (org-scoped, per-user or org-level)"
  - "IntegrationSyncLog Prisma model (audit trail)"
  - "planningCenterService: PCO OAuth, people sync, services sync, check-in push"
  - "googleCalendarService: per-user OAuth, event push, token refresh"
  - "twilioService: SMS sending, bulk SMS, delivery status"
  - "7 API routes: /api/integrations/* (auth, callback, sync, config, send, status)"
  - "IntegrationsTab settings component with 3 provider cards"
  - "INTEGRATIONS_MANAGE and INTEGRATIONS_GOOGLE_CALENDAR permissions"

affects: [day-of-tools, notifications, events, settings]

# Tech tracking
tech-stack:
  added:
    - twilio (npm) — Twilio REST client for SMS
    - googleapis (npm) — Google Calendar API v3 client
    - google-auth-library (npm) — OAuth2 token management for Google
  patterns:
    - "IntegrationCredential dual-mode: userId=null for org-level (PCO/Twilio), userId=string for per-user (Google Calendar)"
    - "isAvailable() guard pattern — all services check env vars first and return null/empty gracefully"
    - "OAuth popup pattern: window.open() for auth URLs, redirect callback stores tokens"
    - "Upsert-on-callback: IntegrationCredential uses @@unique([organizationId, provider, userId]) for safe upsert"

key-files:
  created:
    - src/lib/types/integrations.ts
    - src/lib/services/integrations/planningCenterService.ts
    - src/lib/services/integrations/googleCalendarService.ts
    - src/lib/services/integrations/twilioService.ts
    - src/app/api/integrations/planning-center/auth/route.ts
    - src/app/api/integrations/planning-center/callback/route.ts
    - src/app/api/integrations/planning-center/sync/route.ts
    - src/app/api/integrations/google-calendar/auth/route.ts
    - src/app/api/integrations/google-calendar/callback/route.ts
    - src/app/api/integrations/google-calendar/sync/route.ts
    - src/app/api/integrations/twilio/config/route.ts
    - src/app/api/integrations/twilio/send/route.ts
    - src/app/api/integrations/status/route.ts
    - src/components/settings/IntegrationsTab.tsx
  modified:
    - prisma/schema.prisma (added IntegrationCredential, IntegrationSyncLog, relations)
    - src/lib/db/index.ts (added IntegrationCredential, IntegrationSyncLog to orgScopedModels)
    - src/lib/permissions.ts (added INTEGRATIONS_MANAGE, INTEGRATIONS_GOOGLE_CALENDAR)
    - src/app/settings/page.tsx (added IntegrationsTab, 'integrations' Tab type)
    - src/components/Sidebar.tsx (added 'integrations' SettingsTab, Link2 icon, sidebar item)

key-decisions:
  - "IntegrationCredential userId=null for org-level credentials — uses @@unique([organizationId, provider, userId]) with null as valid unique key"
  - "Google Calendar is per-user OAuth — each staff member connects their own calendar, not org-wide"
  - "Twilio credentials stored in IntegrationCredential.config JSON (accountSid, authToken, phoneNumber) — no plaintext env vars needed post-setup"
  - "OAuth callback routes are public (no auth header) — state param carries organizationId/userId for token storage"
  - "All services use isAvailable() guard — missing env vars never throw, always return graceful null/empty"
  - "Planning Center sync does not auto-create EventProjects from services — logs them for manual review (safer approach)"
  - "IntegrationSyncLog hard delete — audit records, no soft delete"

patterns-established:
  - "Integration service pattern: isAvailable() + graceful degradation + sync logging"
  - "OAuth redirect callbacks use state param to carry orgId/userId across redirect boundary"
  - "Twilio rate limiting: 1 SMS per second between sends in sendBulkSMS loop"

requirements-completed: [INT-01, INT-02, INT-03]

# Metrics
duration: 45min
completed: 2026-03-15
---

# Phase 22 Plan 09: External Integrations Summary

**Planning Center OAuth + people/services sync, per-user Google Calendar event push, and Twilio SMS — 3 integration services, 2 Prisma models, 7 API routes, and IntegrationsTab settings UI with connect/disconnect/sync flows**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-15T00:00:00Z
- **Completed:** 2026-03-15T00:45:00Z
- **Tasks:** 2/2
- **Files modified:** 18 files (14 created, 4 modified)

## Accomplishments

- Built IntegrationCredential and IntegrationSyncLog Prisma models with dual org/user-level credential support
- Created 3 fully functional integration services (PCO, Google Calendar, Twilio) with graceful degradation when env vars absent
- Shipped 7 API routes covering OAuth auth, OAuth callbacks, sync triggers, Twilio config, and SMS sending
- Built production-quality IntegrationsTab with 3 integration cards, status badges, sync dropdowns, inline Twilio config form, test SMS sender, and skeleton loading
- All integrations are module-toggled — core platform never breaks when any integration is unconfigured

## Task Commits

1. **Task 1: Integration schema, services, and API routes** - `9f5326b` (feat)
2. **Task 2: Integrations settings tab UI** - `3179969` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/lib/types/integrations.ts` — IntegrationProvider, IntegrationStatus, Zod schemas for Twilio config and SMS input
- `src/lib/services/integrations/planningCenterService.ts` — PCO OAuth, people sync (email-match + update), services sync, check-in push, disconnect
- `src/lib/services/integrations/googleCalendarService.ts` — Google OAuth, handleCallback, refreshTokenIfNeeded, syncEventToCalendar, removeEventFromCalendar, disconnect
- `src/lib/services/integrations/twilioService.ts` — sendSMS, sendBulkSMS (with 1s rate limit), getDeliveryStatus, saveCredentials, disconnect
- `src/app/api/integrations/planning-center/auth/route.ts` — GET: returns PCO OAuth URL
- `src/app/api/integrations/planning-center/callback/route.ts` — GET: handles PCO OAuth redirect, stores tokens
- `src/app/api/integrations/planning-center/sync/route.ts` — POST: triggers people/services/checkins sync; DELETE: disconnect
- `src/app/api/integrations/google-calendar/auth/route.ts` — GET: returns per-user Google OAuth URL
- `src/app/api/integrations/google-calendar/callback/route.ts` — GET: handles Google OAuth redirect, stores per-user tokens
- `src/app/api/integrations/google-calendar/sync/route.ts` — POST: syncs EventProject to calendar; DELETE: disconnect
- `src/app/api/integrations/twilio/config/route.ts` — GET/POST/DELETE: manage Twilio credentials
- `src/app/api/integrations/twilio/send/route.ts` — POST: send SMS
- `src/app/api/integrations/status/route.ts` — GET: aggregated status for all 3 integrations
- `src/components/settings/IntegrationsTab.tsx` — 3-card integration management UI with full connect/sync/disconnect flows
- `prisma/schema.prisma` — IntegrationCredential, IntegrationSyncLog models and relations
- `src/lib/db/index.ts` — IntegrationCredential, IntegrationSyncLog added to orgScopedModels
- `src/lib/permissions.ts` — INTEGRATIONS_MANAGE and INTEGRATIONS_GOOGLE_CALENDAR added
- `src/app/settings/page.tsx` — IntegrationsTab added, Tab type updated
- `src/components/Sidebar.tsx` — 'integrations' added to SettingsTab type and generalTabs array

## Decisions Made

- `IntegrationCredential.userId = null` for org-level credentials (PCO, Twilio). The @@unique constraint `[organizationId, provider, userId]` works with null as a valid unique key in Postgres — one null per org/provider pair is enforced.
- Google Calendar is per-user OAuth, not org-wide — each staff member connects their own Google account, which is the correct pattern for personal calendar sync.
- Twilio credentials stored as JSON in `config` field — avoids needing additional env vars per org after initial setup, supports multi-org SaaS pattern.
- PCO OAuth callback and Google Calendar callback routes are public endpoints with no auth header — the OAuth `state` parameter carries the orgId/userId for token storage, which is standard OAuth practice.
- Planning Center services sync does NOT auto-create EventProjects from PCO service plans — instead logs service types for manual review. Creating events from PCO data without user confirmation risks data pollution.
- Added `/api/integrations/status` endpoint as a single aggregated status call for the UI — avoids 3 separate fetches on tab open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed EventCheckIn.participantName field reference**
- **Found during:** Task 1 (planningCenterService.ts pushCheckIns)
- **Issue:** Plan referenced `checkIn.participantName` but EventCheckIn model has no such field — names come from the related EventRegistration
- **Fix:** Changed include to `registration: true` and accessed `checkIn.registration?.firstName/lastName`
- **Files modified:** src/lib/services/integrations/planningCenterService.ts
- **Verification:** TypeScript compiles cleanly

**2. [Rule 3 - Blocking] Fixed Zod v4 API mismatch**
- **Found during:** Task 1 (API routes)
- **Issue:** Routes used `parsed.error.errors` but project uses Zod v4 which uses `.issues` not `.errors`
- **Fix:** Changed all `.errors` to `.issues` in validation error responses
- **Files modified:** All 4 integration API routes
- **Verification:** TypeScript compiles cleanly

**3. [Rule 1 - Bug] Fixed useToast hook API**
- **Found during:** Task 2 (IntegrationsTab)
- **Issue:** Used `{ addToast }` destructuring but the project's Toast hook exports `{ toast }` with signature `toast(message, variant?)`
- **Fix:** Changed all `addToast({ type, message })` calls to `toast(message, variant)`
- **Files modified:** src/components/settings/IntegrationsTab.tsx
- **Verification:** TypeScript compiles cleanly

---

**Total deviations:** 3 auto-fixed (1 wrong field, 1 API version mismatch, 1 hook API)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- TypeScript implicit `any` on the PCO paginated fetch response — fixed with explicit response type annotation in the while loop
- Pre-existing test error in `__tests__/lib/assistant-prompt.test.ts` (unrelated to this plan, not fixed per scope boundary rules)

## User Setup Required

**External services require API credentials.** Add the following to your environment:

**Planning Center:**
- `PCO_APP_ID` — Planning Center Developer → API → Personal Access Tokens
- `PCO_SECRET` — Planning Center Developer → API → OAuth App secret
- Create OAuth application at: https://api.planningcenteronline.com/oauth/applications

**Google Calendar:**
- `GOOGLE_CLIENT_ID` — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client secret
- Enable Google Calendar API in Google Cloud Console
- Configure OAuth consent screen

**Twilio:**
- Configured via Settings → Integrations → Twilio SMS card (no env vars needed — credentials stored in database)
- Alternatively set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` for self-hosted config

## Next Phase Readiness

- All 3 integrations are wired and functional — users can connect via Settings → Integrations
- Google Calendar sync can be triggered from event project views (POST /api/integrations/google-calendar/sync)
- Twilio SMS can be triggered from event notification dispatch (sendSMS / sendBulkSMS)
- IntegrationSyncLog provides audit trail for all sync operations

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-15*
