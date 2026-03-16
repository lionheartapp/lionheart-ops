---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "07"
subsystem: ui
tags: [react, framer-motion, supabase-realtime, tanstack-query, presence, announcements, surveys]

requires:
  - phase: 21-06
    provides: announcement/survey/presence API routes + services

provides:
  - EventCommsTab: full Announcements + Surveys dual-sub-tab UI replacing the placeholder
  - AnnouncementComposer: form with 4 audience targeting options + confirmation dialog
  - AnnouncementFeed: reverse-chronological card list with read-more + inline delete confirm
  - SurveyManager: survey list with DRAFT/ACTIVE/CLOSED status toggle, results panel with bar charts
  - PresenceBar: Google Docs-style avatar row with aurora ring for current user
  - usePresence hook: DB heartbeat + Supabase Realtime + polling fallback
  - useEventComms hook: TanStack Query hooks for announcement and survey CRUD
  - supabase-browser.ts: singleton browser Supabase client with graceful null fallback
  - PortalView announcements section: live from /api/registration/[id]/announcements, 30s auto-refresh

affects:
  - EventProjectTabs (PresenceBar now renders in tab header)
  - PortalView (live announcements for parents)

tech-stack:
  added: []
  patterns:
    - Supabase Realtime presence channel with polling fallback (graceful degradation)
    - Presence heartbeat via useEffect + setInterval with cleanup on unmount
    - Sub-tab navigation pattern within a parent tab (CommsSubTab inside EventCommsTab)
    - Live data in parent portal via native fetch + setInterval (no TanStack Query dependency on portal page)
    - CSS mask technique for aurora gradient ring on avatar (outline-only gradient border)

key-files:
  created:
    - src/lib/supabase-browser.ts
    - src/lib/hooks/useEventComms.ts
    - src/lib/hooks/usePresence.ts
    - src/components/events/comms/AnnouncementComposer.tsx
    - src/components/events/comms/AnnouncementFeed.tsx
    - src/components/events/comms/SurveyManager.tsx
    - src/components/events/comms/PresenceBar.tsx
  modified:
    - src/components/events/EventCommsTab.tsx
    - src/components/events/EventProjectTabs.tsx
    - src/components/registration/PortalView.tsx

key-decisions:
  - "userId for PresenceBar read from localStorage 'user-id' key (consistent with existing pattern in maintenance/IT components)"
  - "usePresence hook tracks activeTab via ref to avoid stale closure in heartbeat interval"
  - "PortalView uses native fetch + setInterval (not TanStack Query) — portal page has no QueryProvider wrapper"
  - "SurveyManager reuses existing RegistrationForm via formId — survey creation requires form to exist first"
  - "PresenceBar returns null when no users active (not even current user) — avoids layout shift on mount"

duration: 7min
completed: "2026-03-15"
---

# Phase 21 Plan 07: Communication Tab UI and Presence Summary

**Event communication tab UI with announcement composer/feed, survey manager with aggregated results, and Google Docs-style real-time presence bar — all wired to the Phase 21-06 API routes.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-15T23:24:27Z
- **Completed:** 2026-03-15T23:31:30Z
- **Tasks:** 2
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments

- AnnouncementComposer provides 4 audience modes (All Registrants, Specific Group, Incomplete Docs, Paid Only) with a group picker dropdown and a send confirmation dialog
- AnnouncementFeed renders announcements with relative timestamps ("2 hours ago"), audience badges, author avatars, read-more expansion, and inline delete confirm
- SurveyManager shows status badges (DRAFT/ACTIVE/CLOSED), one-click status transitions, per-survey results panel with bar charts for choice fields and quoted text for free-response fields
- PresenceBar renders avatar circles with aurora gradient ring on the current user, overflow "+N" chip, hover tooltips with name + active tab, and AnimatePresence for smooth entry/exit
- usePresence hook: DB heartbeat every 30s, DELETE on unmount, Supabase Realtime subscription if env vars set, polling fallback at 15s interval
- PortalView announcements section fetches live from `/api/registration/[id]/announcements` and auto-refreshes every 30s with skeleton loading state
- EventCommsTab replaces the placeholder with two sub-tabs and a quick stats row (announcements sent, active surveys count)
- EventProjectTabs reads `user-id` from localStorage and renders PresenceBar at the right end of the tab bar

## Task Commits

Each task was committed atomically:

1. **Task 1: Create comms hooks, presence hook, announcement UI, and survey manager** - `047ecab` (feat)
2. **Task 2: Build PresenceBar, replace EventCommsTab, update EventProjectTabs and PortalView** - `bfdc1b1` (feat)

## Files Created/Modified

- `src/lib/supabase-browser.ts` - Singleton Supabase browser client, null if env vars absent
- `src/lib/hooks/useEventComms.ts` - TanStack Query hooks: useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, useSurveys, useCreateSurvey, useUpdateSurvey, useDeleteSurvey, useSurveyResults
- `src/lib/hooks/usePresence.ts` - Heartbeat hook with Supabase Realtime + polling fallback, cleanup on unmount
- `src/components/events/comms/AnnouncementComposer.tsx` - Audience-targeted form with group picker and confirmation dialog
- `src/components/events/comms/AnnouncementFeed.tsx` - Card list with relative timestamps, read-more, and inline delete
- `src/components/events/comms/SurveyManager.tsx` - Survey list with status toggle, results bar charts, create modal
- `src/components/events/comms/PresenceBar.tsx` - Avatar row with aurora ring, overflow chip, tooltips, AnimatePresence
- `src/components/events/EventCommsTab.tsx` - Replaced placeholder with Announcements/Surveys sub-tabs + stats row
- `src/components/events/EventProjectTabs.tsx` - Added PresenceBar in tab header (right side)
- `src/components/registration/PortalView.tsx` - Live announcements section with 30s auto-refresh + skeleton loading

## Decisions Made

- **userId from localStorage** — `localStorage.getItem('user-id')` used consistently with existing maintenance/IT components pattern. No new auth API call needed.
- **Native fetch for PortalView announcements** — portal page doesn't have TanStack QueryProvider wrapper, so used native `fetch` + `setInterval` instead of `useQuery`.
- **Supabase Realtime as enhancement** — presence works via DB polling alone; Supabase adds real-time push when configured. `require('@supabase/supabase-js')` is caught in try/catch so missing package doesn't break the app.
- **SurveyManager uses existing RegistrationForm** — consistent with plan spec; survey creation links to existing form via formId. If no form exists, modal shows a clear message.
- **PresenceBar returns null when empty** — avoids layout shift during initial mount before first presence fetch.

## Deviations from Plan

**1. [Rule 3 - Blocking] Removed useAuth import from EventProjectTabs**
- **Found during:** Task 2 implementation
- **Issue:** useAuth hook's AuthState interface doesn't expose `userId` — only user display info (name, email, avatar, role). No `id` field in the returned state.
- **Fix:** Read `user-id` from localStorage directly (consistent with ViewAsDialog, SubmitRequestWizard, TicketDetailPage, WorkOrdersView — all existing components use this pattern)
- **Files modified:** `src/components/events/EventProjectTabs.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors in EventProjectTabs

**2. [Rule 3 - Blocking] Used native fetch for PortalView announcements**
- **Found during:** Task 2 — implementing live announcements in PortalView
- **Issue:** PortalView is used in a public portal page without a TanStack QueryProvider, so `useQuery` would throw at runtime
- **Fix:** Used `useCallback` + `useEffect` + `setInterval` with native `fetch` — same pattern the portal page already uses for its own data fetching
- **Files modified:** `src/components/registration/PortalView.tsx`
- **Verification:** TypeScript passes, pattern matches how portal page operates

---

**Total deviations:** 2 auto-fixed (Rule 3 — Blocking)
**Impact on plan:** Both fixes required for correctness with no scope change.

## Issues Encountered

Pre-existing TypeScript error in `__tests__/lib/assistant-prompt.test.ts` (unrelated to this plan — missing `importance` field). All 10 new/modified source files compile cleanly.

## Self-Check: PASSED

All artifacts verified:
- [x] `src/lib/supabase-browser.ts` — FOUND
- [x] `src/lib/hooks/useEventComms.ts` — FOUND
- [x] `src/lib/hooks/usePresence.ts` — FOUND
- [x] `src/components/events/comms/AnnouncementComposer.tsx` — FOUND
- [x] `src/components/events/comms/AnnouncementFeed.tsx` — FOUND
- [x] `src/components/events/comms/SurveyManager.tsx` — FOUND
- [x] `src/components/events/comms/PresenceBar.tsx` — FOUND
- [x] `src/components/events/EventCommsTab.tsx` — FOUND
- [x] `src/components/events/EventProjectTabs.tsx` — FOUND
- [x] `src/components/registration/PortalView.tsx` — FOUND
- [x] Commit 047ecab — FOUND (Task 1: hooks + components)
- [x] Commit bfdc1b1 — FOUND (Task 2: PresenceBar + integration)
- [x] `npx tsc --noEmit` — Only pre-existing error in `__tests__/lib/assistant-prompt.test.ts` (unrelated)
- [x] EventCommsTab no longer shows "Set up in Communications phase" placeholder
- [x] PresenceBar imported and rendered in EventProjectTabs
- [x] PortalView has live Announcements section with 30s auto-refresh
- [x] supabase-browser.ts exports client with null fallback

## Next Phase Readiness

- COM-01: Staff can compose and send targeted announcements (audience: ALL, GROUP, INCOMPLETE_DOCS, PAID_ONLY)
- COM-02: Parents see announcements on portal, auto-refreshing every 30s
- COM-04: Staff can create/manage surveys and view aggregated results
- COM-05: Presence bar shows active collaborators with avatar circles and aurora ring
- Plan 08+ can use the presence infrastructure and comms hooks

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
