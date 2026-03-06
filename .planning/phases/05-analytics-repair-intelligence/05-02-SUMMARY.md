---
phase: 05-analytics-repair-intelligence
plan: 02
subsystem: maintenance
tags: [anthropic, email, cron, prisma, notifications, badges, ui]

# Dependency graph
requires:
  - phase: 05-analytics-repair-intelligence
    provides: analytics service, dashboard foundation from 05-01

provides:
  - Repeat repair detection service (3 detection triggers: repeat repair, cost threshold, end of life)
  - AI replace-vs-repair recommendation via Anthropic Claude stored as JSON on asset
  - Three email alert functions + templates for Head of Maintenance alerts
  - Idempotency enforcement: no duplicate alerts within 30 days
  - Cron job extended with Task 3 repeat repair detection per org
  - Badge UI on asset detail page (Repeat Repair, Cost Threshold Exceeded, End of Life)
  - AI recommendation panel on asset detail page when cost threshold exceeded
  - Alert column in asset register table with icon indicators
  - Pulsing orange dot on ticket cards when linked asset has active alerts

affects:
  - 06-compliance-board-reporting
  - any phase that reads asset or ticket data

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk (already installed from Phase 03)"
    - "html5-qrcode (pre-existing missing package, installed as Rule 3 fix)"
  patterns:
    - "Idempotency via timestamp fields on model: check alertSentAt >= thirtyDaysAgo before sending"
    - "Fire-and-forget email + notifications: .catch() logging, never blocks detection loop"
    - "AI recommendation stored as Json? on asset, re-used if fresh (<30 days)"
    - "Alert badge computation at render time from ticketHistory (not stored booleans)"
    - "Asset alert sentinel fields (repeatAlertSentAt, costAlertSentAt, eolAlertSentAt) as lightweight proxy for table display"

key-files:
  created:
    - src/lib/services/repeatRepairService.ts
  modified:
    - prisma/schema.prisma
    - src/app/api/cron/maintenance-tasks/route.ts
    - src/lib/services/emailService.ts
    - src/lib/email/templates.ts
    - src/lib/services/notificationService.ts
    - src/lib/services/maintenanceTicketService.ts
    - src/components/maintenance/AssetDetailPage.tsx
    - src/components/maintenance/AssetRegisterTable.tsx
    - src/components/maintenance/TicketCard.tsx

key-decisions:
  - "Detection runs against all active non-DECOMMISSIONED assets; recipients resolved via maintenance:analytics:view permission (OR super-admin wildcard OR maintenance:*)"
  - "Notification type strings use snake_case matching existing pattern (maintenance_repeat_repair, maintenance_cost_threshold, maintenance_end_of_life)"
  - "TenantModule lookup uses moduleId field not moduleKey — schema uses moduleId (existence = enabled, no isEnabled flag)"
  - "AI recommendation stored fresh check: 30-day window prevents redundant Anthropic API calls on re-runs"
  - "Badge conditions derived at render time from ticketHistory/cumulativeRepairCost — not from flag fields — to stay in sync with live data"
  - "Asset sentinel fields (repeatAlertSentAt etc.) used as proxy for table display since full ticket history not loaded in list query"

patterns-established:
  - "Repeat repair intelligence pattern: load assets + tickets + costs in one query, compute conditions, check idempotency, send alerts fire-and-forget"
  - "AI prompt returns JSON {recommendation, decision, urgency}; extract via regex match to handle markdown code block wrapping"

requirements-completed: [REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04]

# Metrics
duration: 9min
completed: 2026-03-06
---

# Phase 5 Plan 2: Repeat Repair Intelligence Summary

**Cron-driven repeat repair detection with Anthropic AI replace-vs-repair recommendation, three email alert types (repeat repair, cost threshold, end of life), idempotency via 30-day cooldown, and badge + AI panel UI on asset detail page**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-06T16:13:18Z
- **Completed:** 2026-03-06T16:22:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created `repeatRepairService.ts` with three detection functions, AI recommendation generation via Anthropic, and email/notification dispatch
- Extended cron job to run repeat repair detection per org (using tenantModule lookup) after existing PM and stale ticket tasks
- Added Repeat Repair, Cost Threshold, End of Life badges to asset detail page — computed at render time from ticketHistory
- Added AI replace-vs-repair recommendation panel (shown when isCostThresholdExceeded && aiRecommendation populated)
- Added Alerts column to asset register table with compact icon indicators
- Added pulsing orange dot to ticket cards when linked asset has active alerts

## Task Commits

1. **Task 1: Schema, detection service, email functions, cron integration** - `1565ab6` (feat)
2. **Task 2: Badge display on asset detail, register table, ticket cards** - `86beacb` (feat)

**Plan metadata:** see final docs commit

## Files Created/Modified
- `src/lib/services/repeatRepairService.ts` — Core detection service (runRepeatRepairDetection, generateReplaceVsRepairRecommendation, detectEndOfLife)
- `prisma/schema.prisma` — 5 new fields on MaintenanceAsset (aiRecommendation, aiRecommendationAt, repeatAlertSentAt, costAlertSentAt, eolAlertSentAt)
- `src/app/api/cron/maintenance-tasks/route.ts` — Task 3 added: per-org repeat repair detection
- `src/lib/services/emailService.ts` — 3 new alert email functions (sendRepeatRepairAlertEmail, sendCostThresholdAlertEmail, sendEndOfLifeAlertEmail)
- `src/lib/email/templates.ts` — 3 new email templates + SUBJECTS + TEXT_BODIES entries
- `src/lib/services/notificationService.ts` — 3 new NotificationType values
- `src/lib/services/maintenanceTicketService.ts` — asset relation added to TICKET_INCLUDES with alert sentinel fields
- `src/components/maintenance/AssetDetailPage.tsx` — Alert badges, AI recommendation panel
- `src/components/maintenance/AssetRegisterTable.tsx` — Alerts column with icon indicators, alert sentinel fields on type
- `src/components/maintenance/TicketCard.tsx` — Pulsing orange dot when asset has alerts, asset relation on type

## Decisions Made
- TenantModule uses `moduleId` field (not `moduleKey`), module existence = enabled (no `isEnabled` flag)
- Notification types follow existing snake_case pattern: `maintenance_repeat_repair`, `maintenance_cost_threshold`, `maintenance_end_of_life`
- AI recommendation uses 30-day freshness window to avoid redundant Anthropic API calls
- Badge conditions computed at render time from ticketHistory (not stored booleans) to stay in sync with live ticket status
- Sentinel date fields on asset used as lightweight proxy in table (no full ticket history loaded for list view)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing html5-qrcode package**
- **Found during:** Task 2 (build verification)
- **Issue:** `npm run build` failed with "Module not found: Can't resolve 'html5-qrcode'" — pre-existing issue from Phase 04
- **Fix:** Ran `npm install html5-qrcode`
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passes successfully after install
- **Committed in:** 86beacb (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TenantModule field name mismatch**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan specified `moduleKey` and `isEnabled` fields but TenantModule schema uses `moduleId` with existence-as-enabled semantics
- **Fix:** Changed query to use `moduleId: 'maintenance'` without `isEnabled` filter
- **Files modified:** src/app/api/cron/maintenance-tasks/route.ts
- **Verification:** TypeScript compiles, query is valid against schema
- **Committed in:** 1565ab6 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed NotificationType mismatch**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan used `type: 'MAINTENANCE'` but NotificationType union required specific lowercase strings
- **Fix:** Added three new values to NotificationType, used them in service calls
- **Files modified:** src/lib/services/notificationService.ts, src/lib/services/repeatRepairService.ts
- **Verification:** TypeScript compiles without type errors
- **Committed in:** 1565ab6 (Task 1 commit)

**4. [Rule 1 - Bug] Fixed CreateNotificationInput missing organizationId**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan's code sample included `organizationId` in createNotification call but the interface doesn't accept it (org-scoped prisma handles injection automatically)
- **Fix:** Removed `organizationId` from all three createNotification calls
- **Files modified:** src/lib/services/repeatRepairService.ts
- **Verification:** TypeScript compiles
- **Committed in:** 1565ab6 (Task 1 commit)

**5. [Rule 1 - Bug] Fixed template literal shorthand property error in email template**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `${{cumulativeCost}}` inside a template literal caused TS18004 (shorthand property) — TypeScript interprets `${` as template expression start
- **Fix:** Changed backtick string to regular single-quoted string for that detailCard argument
- **Files modified:** src/lib/email/templates.ts
- **Verification:** TypeScript compiles
- **Committed in:** 1565ab6 (Task 1 commit)

---

**Total deviations:** 5 auto-fixed (2 Rule 1 bugs, 3 Rule 1/3 bugs)
**Impact on plan:** All fixes necessary for correct compilation and runtime operation. No scope creep.

## Issues Encountered
- Schema field name differences between plan spec and actual schema required correction at TypeScript check time (TenantModule.moduleId vs moduleKey)
- Template literal `${{ }}` syntax conflict with TypeScript when template variable placeholder starts with `$`

## Next Phase Readiness
- Repeat repair detection ready for cron scheduling
- AI recommendation stored on asset for display in detail page
- Email + notification alerts wired and idempotency enforced
- Phase 06 (compliance board reporting) can proceed using asset data including alert fields

## Self-Check: PASSED

- `src/lib/services/repeatRepairService.ts` — FOUND
- `src/components/maintenance/AssetDetailPage.tsx` — FOUND
- `.planning/phases/05-analytics-repair-intelligence/05-02-SUMMARY.md` — FOUND
- Commit `1565ab6` — FOUND
- Commit `86beacb` — FOUND

---
*Phase: 05-analytics-repair-intelligence*
*Completed: 2026-03-06*
