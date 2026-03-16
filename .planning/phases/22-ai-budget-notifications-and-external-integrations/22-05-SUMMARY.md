---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 05
subsystem: ui
tags: [tanstack-query, framer-motion, notifications, ai-draft, timeline, drawer]

# Dependency graph
requires:
  - phase: 22-02
    provides: EventNotificationRule, EventNotificationLog, notification API routes, notificationOrchestrationService
provides:
  - useNotificationRules + useNotificationMutations + useAIDraft hooks
  - NotificationTimelinePin component
  - NotificationTimeline Gantt-lite component
  - NotificationRuleDrawer with AI drafting and approval workflow
  - POST /api/events/projects/[id]/notifications/ai-draft endpoint
  - Notifications sub-tab in EventCommsTab
affects:
  - EventCommsTab: added Notifications tab (third sub-tab alongside Announcements and Surveys)
  - EventProjectTabs: passes eventTitle and eventStartDate to EventCommsTab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gantt-lite timeline pattern: pixelsPerDay * dayOffset positioning for date-based pins"
    - "Action-triggered lane: separate list below timeline for ACTION_TRIGGERED rules (no fixed date)"
    - "Status-aware drawer footer: different button sets for DRAFT/PENDING_APPROVAL/APPROVED/SENT/CANCELLED"
    - "AI-generated badge: inline badge in subject field, cleared on manual edit"
    - "Optimistic deletion in useNotificationMutations.deleteRule: cancelQueries + setQueryData, revert on error"

key-files:
  created:
    - src/lib/hooks/useNotificationRules.ts
    - src/components/events/comms/NotificationTimelinePin.tsx
    - src/components/events/comms/NotificationTimeline.tsx
    - src/components/events/comms/NotificationRuleDrawer.tsx
    - src/app/api/events/projects/[id]/notifications/ai-draft/route.ts
  modified:
    - src/components/events/EventCommsTab.tsx (added Notifications sub-tab, 3-stat row, drawer state)
    - src/components/events/EventProjectTabs.tsx (pass eventTitle + eventStartDate to EventCommsTab)

key-decisions:
  - "AI draft endpoint placed at /notifications/ai-draft (not /events/ai) to keep notification concerns co-located with notification routes"
  - "eventTitle and eventStartDate are optional props with sensible defaults in EventCommsTab — backward compatible"
  - "Gantt-lite horizontal timeline uses DAYS_BEFORE=30 and DAYS_AFTER=7 spans — visible planning window for school events"
  - "ACTION_TRIGGERED rules rendered in separate lane below timeline — these have no fixed date so cannot be positioned on the Gantt axis"

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 22 Plan 05: Notification Timeline UI Summary

**Gantt-lite notification timeline builder in the Comms tab with AI-drafted messages, three trigger types, and staff approval workflow before any notification queues for send**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-16T02:06:07Z
- **Completed:** 2026-03-16T02:13:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Full TanStack Query hook layer for notification rules: fetch with 60s refetch, mutations for full CRUD + workflow transitions, optimistic deletion
- `useAIDraft` mutation calling the new `/notifications/ai-draft` endpoint, backed by `generateNotificationDraft` from eventAIService
- AI draft endpoint at `POST /api/events/projects/[id]/notifications/ai-draft` — auth-gated, returns `{ subject, body }` or 503 AI_UNAVAILABLE
- `NotificationTimelinePin`: status-colored pin (DRAFT=gray, PENDING_APPROVAL=amber pulse, APPROVED=blue, SENT=green+check, CANCELLED=red line-through) with trigger type icon, hover tooltip, click-to-edit
- `NotificationTimeline`: Gantt-lite horizontal timeline with 30-day before / 7-day after event spans, event day aurora gradient marker, scrollable, empty state CTA, action-triggered rules in separate lane
- `NotificationRuleDrawer`: 3-section form (Trigger/Audience/Message) with segmented trigger type control, date preview computation, AI Draft button with sparkle icon, AI-generated badge, read-only view for SENT/CANCELLED
- `EventCommsTab`: new Notifications sub-tab, expanded stats row to 3 cards (added notifications count), drawer open/close/edit state
- `EventProjectTabs`: now passes `eventTitle` and `eventStartDate` to EventCommsTab so timeline anchors correctly

## Task Commits

1. **Task 1: Notification rules hooks and timeline components** - `61f6848` (feat)
2. **Task 2: Notification rule drawer with AI drafting and EventCommsTab integration** - `35d3548` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

### Created
- `src/lib/hooks/useNotificationRules.ts` — 188 lines: `useNotificationRules`, `useNotificationMutations`, `useAIDraft`
- `src/components/events/comms/NotificationTimelinePin.tsx` — 206 lines: pin with status styles, tooltip, trigger icon
- `src/components/events/comms/NotificationTimeline.tsx` — 309 lines: Gantt-lite timeline, action lane, empty state
- `src/components/events/comms/NotificationRuleDrawer.tsx` — 646 lines: drawer with all trigger types, AI draft, approval workflow
- `src/app/api/events/projects/[id]/notifications/ai-draft/route.ts` — 62 lines: AI draft generation endpoint

### Modified
- `src/components/events/EventCommsTab.tsx` — Added Notifications sub-tab, 3-stat grid, drawer management, NotificationTimeline + NotificationRuleDrawer wiring
- `src/components/events/EventProjectTabs.tsx` — Pass `eventTitle` and `eventStartDate` to EventCommsTab

## Decisions Made

- AI draft endpoint co-located with notification routes (`/notifications/ai-draft`) rather than the shared `/events/ai` directory — notification concerns are self-contained
- `eventTitle` and `eventStartDate` are optional in `EventCommsTabProps` with sensible fallbacks — backward compatible with any existing usages that only pass `eventProjectId`
- Gantt timeline uses 30 days before / 7 days after — covers full pre-event planning window for typical school events
- ACTION_TRIGGERED rules rendered in a separate list lane below the Gantt — these fire on events, not at fixed times, so cannot be positioned on a date axis

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Additional Work

**[Rule 2 - Missing functionality] Created AI draft API endpoint**
- **Found during:** Task 1 (hook design)
- **Reason:** `useAIDraft` hook referenced `/api/events/projects/${id}/notifications/ai-draft` which did not exist. Plan mentioned `/api/events/ai/generate-summary` as a possible target but stated "or a dedicated notification draft endpoint" — created the dedicated endpoint since it's a cleaner separation.
- **Fix:** Created `POST /api/events/projects/[id]/notifications/ai-draft/route.ts` calling `generateNotificationDraft` from eventAIService
- **Impact:** Zero scope creep — the endpoint is exactly what the hook needed; no new AI logic, reuses existing service

## Issues Encountered

- Pre-existing TypeScript errors in `BudgetExpenseDrawer.tsx`, `BudgetRevenueSection.tsx`, integration routes (`.errors` vs `.issues` Zod property), and `assistant-prompt.test.ts` — all unrelated to this plan, out of scope per deviation rules.
- No errors introduced in any of this plan's new files.

## Success Criteria Verification

- [x] Visual timeline builder shows notification pins on Gantt-lite horizontal timeline
- [x] Three trigger types have appropriate configuration UI (date-based with offset+direction, condition-based with threshold days, action-triggered with action picker)
- [x] AI auto-drafts message content when "AI Draft" button clicked
- [x] Staff approval required before notifications queue (DRAFT → submit → PENDING_APPROVAL → approve → APPROVED)
- [x] Timeline integrates cleanly into existing Comms tab as a third sub-tab

## Self-Check: PASSED

All artifacts verified:
- `src/lib/hooks/useNotificationRules.ts`: FOUND
- `src/components/events/comms/NotificationTimelinePin.tsx`: FOUND
- `src/components/events/comms/NotificationTimeline.tsx`: FOUND
- `src/components/events/comms/NotificationRuleDrawer.tsx`: FOUND
- `src/app/api/events/projects/[id]/notifications/ai-draft/route.ts`: FOUND
- Commit `61f6848` (Task 1): FOUND
- Commit `35d3548` (Task 2): FOUND
- TypeScript: no new errors in plan files

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*
