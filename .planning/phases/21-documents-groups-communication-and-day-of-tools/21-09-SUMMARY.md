---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "09"
subsystem: ui
tags: [pwa, offline, dexie, qr-scanner, check-in, incidents, day-of, html5-qrcode, framer-motion, service-worker]

requires:
  - phase: 21-08
    provides: check-in and incident API routes, public self-service endpoint at /api/events/check-in/[id]

provides:
  - eventDb: Dexie DB with eventCheckInQueue, cachedParticipants, eventIncidentQueue tables
  - event-sync: syncCheckIns, syncIncidents, cacheRoster, getCachedParticipant, syncAll, getPendingCount
  - useCheckIn: online/offline hook with 5s counter poll, 10s list poll, auto-sync on reconnect, undo
  - useIncidents: online/offline hook with 30s poll, offline queue merge
  - CheckInScanner: full-screen html5-qrcode scanner, audio/haptic feedback, auto-reset 3s
  - ParticipantFlashCard: spring-animated result panel with medical gate
  - CheckInList: searchable manual check-in with undo confirmation
  - IncidentForm: structured form with offline-save support
  - IncidentList: collapsible cards with type/severity filters and pending sync indicator
  - DayOfDashboard: 4-tab hub with fullscreen, roster cache, sync button
  - /events/check-in/[registrationId]: public participant self-service page (SSR)

affects:
  - EventProjectTabs.tsx — DayOfDashboard can be wired into a Day-Of tab on the event project
  - Public routes — /events/check-in/ is already public via middleware
  - PWA offline experience — service worker now caches event check-in and incident APIs

tech-stack:
  added: []
  patterns:
    - Separate Dexie database (lionheart-events-v1) to avoid version conflicts with maintenance DB
    - Online/offline hook pattern — navigator.onLine + window 'online'/'offline' events + Dexie fallback
    - Auto-sync on connectivity restore via window.addEventListener('online', ...) in hook
    - Web Audio API tone for QR scan feedback (no external library)
    - navigator.vibrate(200) for haptic feedback with graceful fallback
    - 3-second auto-reset in CheckInScanner for back-to-back scanning (40 kids off a bus)
    - cacheRoster called on DayOfDashboard mount to pre-populate offline cache
    - registrationId-as-access-token pattern (non-guessable cuid) for public self-service page
    - SSR public page with notFound() on missing registration (FERPA: no medical data)

key-files:
  created:
    - src/lib/offline/event-db.ts
    - src/lib/offline/event-sync.ts
    - src/lib/hooks/useCheckIn.ts
    - src/lib/hooks/useIncidents.ts
    - src/components/events/dayof/ParticipantFlashCard.tsx
    - src/components/events/dayof/CheckInScanner.tsx
    - src/components/events/dayof/CheckInList.tsx
    - src/components/events/dayof/IncidentForm.tsx
    - src/components/events/dayof/IncidentList.tsx
    - src/components/events/dayof/DayOfDashboard.tsx
    - src/app/events/check-in/[registrationId]/page.tsx
  modified:
    - src/app/sw.ts (added 3 new NetworkFirst caching rules for event APIs)

key-decisions:
  - "Separate Dexie database (lionheart-events-v1) keeps event offline tables isolated from maintenance DB to prevent version conflicts on schema upgrades"
  - "Web Audio API tone + navigator.vibrate() for scan feedback — no external dependency, graceful fallback on unsupported browsers"
  - "cacheRoster() called on DayOfDashboard mount — pre-populates offline cache when online so offline mode immediately has data"
  - "3-second auto-reset in CheckInScanner — optimized for speed (40 kids off a bus) with flash card visible long enough to verify"
  - "SSR public self-service page uses notFound() on missing registration — clean 404 UX, no medical data ever returned (FERPA)"

requirements-completed: [QR-01, QR-02, QR-03, QR-04, QR-05]

duration: 9min
completed: 2026-03-15
---

# Phase 21 Plan 09: Day-of Operations UI Summary

**Full-screen QR scanner with audio/haptic feedback, participant flash card, offline Dexie queues, incident form and list, 4-tab day-of dashboard, and FERPA-safe public self-service page — all with automatic offline sync**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-15T23:24:00Z
- **Completed:** 2026-03-15T23:33:00Z
- **Tasks:** 2
- **Files created:** 11 (5 lib/hooks/offline, 6 UI components + 1 page)
- **Files modified:** 1 (service worker)

## Accomplishments

- **Task 1 — Offline infrastructure:** Dexie database `lionheart-events-v1` with 3 tables (eventCheckInQueue, cachedParticipants, eventIncidentQueue). Sync module with `syncAll()` auto-triggered on `window.addEventListener('online')`. `useCheckIn` hook with 5s counter poll, 10s list poll, online/offline check-in, undo. `useIncidents` hook with 30s poll and offline queue merge. Service worker updated with 3 new NetworkFirst rules.

- **Task 2 — Day-of UI:** CheckInScanner with html5-qrcode, Web Audio API beep (880Hz→440Hz envelope), navigator.vibrate(200), 3-second auto-reset. ParticipantFlashCard with spring animation, group badges by type (Bus/Cabin/Small Group/Activity), medical flags gated by permission. CheckInList with search, undo confirmation pattern. IncidentForm with type/severity radio buttons, participant multi-select with chips, photo attachment, offline-aware toast. IncidentList with collapsible cards, type/severity filters, pending sync badge. DayOfDashboard with 4 tabs, fullscreen toggle, sync button, headcount with per-group breakdown. Public participant self-service SSR page.

## Task Commits

1. **Task 1: Offline Dexie tables, sync module, hooks, service worker** - `4168b87` (feat)
2. **Task 2: Day-of UI components + participant self-service page** - `c5ccfb2` (feat — included in prior plan 03 docs commit)

## Files Created/Modified

- `src/lib/offline/event-db.ts` — Dexie DB with eventCheckInQueue, cachedParticipants, eventIncidentQueue
- `src/lib/offline/event-sync.ts` — syncCheckIns, syncIncidents, cacheRoster, getCachedParticipant, syncAll, getPendingCount
- `src/lib/hooks/useCheckIn.ts` — online/offline check-in hook with polling and auto-sync
- `src/lib/hooks/useIncidents.ts` — online/offline incident hook with offline queue merge
- `src/components/events/dayof/ParticipantFlashCard.tsx` — spring-animated scan result card
- `src/components/events/dayof/CheckInScanner.tsx` — full-screen html5-qrcode with audio/haptic
- `src/components/events/dayof/CheckInList.tsx` — searchable manual check-in list
- `src/components/events/dayof/IncidentForm.tsx` — structured incident form with offline support
- `src/components/events/dayof/IncidentList.tsx` — incident cards with expand/collapse and filters
- `src/components/events/dayof/DayOfDashboard.tsx` — 4-tab day-of hub
- `src/app/events/check-in/[registrationId]/page.tsx` — public SSR self-service page
- `src/app/sw.ts` — added event-checkin-api, event-incidents-api, event-participant-api caching rules

## Decisions Made

- Separate Dexie database `lionheart-events-v1` keeps event offline tables isolated from maintenance `lionheart-offline-v1` to prevent version conflicts on schema upgrades
- Web Audio API tone + navigator.vibrate() for scan feedback — no external dependency, graceful fallback on unsupported browsers
- cacheRoster() called on DayOfDashboard mount — pre-populates offline cache when online so offline mode immediately has data
- 3-second auto-reset in CheckInScanner — optimized for speed (40 kids off a bus) with flash card visible long enough to verify
- SSR public self-service page uses notFound() on missing registration — clean 404 UX, no medical data ever returned (FERPA compliant)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

Note: Task 2 UI files were found already committed in git (commit c5ccfb2) from a prior plan 09 execution attempt that was included in the plan 03 docs metadata commit. Task 1 offline infrastructure was newly created and committed in 4168b87.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The DayOfDashboard component is ready to be added as a tab in EventProjectTabs whenever Phase 21 plan 10 wires up the final event project integration.

## Next Phase Readiness

- DayOfDashboard ready to be imported into EventProjectTabs (Plan 10 integration)
- All QR requirements (QR-01 through QR-05) now complete
- Offline sync infrastructure reusable for any future offline PWA feature
- Service worker extended for event API endpoints
- Public self-service page fully functional

## Self-Check: PASSED

All artifacts verified:
- [x] src/lib/offline/event-db.ts — FOUND (committed 4168b87)
- [x] src/lib/offline/event-sync.ts — FOUND (committed 4168b87)
- [x] src/lib/hooks/useCheckIn.ts — FOUND (committed 4168b87)
- [x] src/lib/hooks/useIncidents.ts — FOUND (committed 4168b87)
- [x] src/app/sw.ts — FOUND (modified, committed 4168b87)
- [x] src/components/events/dayof/CheckInScanner.tsx — FOUND (committed c5ccfb2)
- [x] src/components/events/dayof/ParticipantFlashCard.tsx — FOUND (committed c5ccfb2)
- [x] src/components/events/dayof/CheckInList.tsx — FOUND (committed c5ccfb2)
- [x] src/components/events/dayof/IncidentForm.tsx — FOUND (committed c5ccfb2)
- [x] src/components/events/dayof/IncidentList.tsx — FOUND (committed c5ccfb2)
- [x] src/components/events/dayof/DayOfDashboard.tsx — FOUND (committed c5ccfb2)
- [x] src/app/events/check-in/[registrationId]/page.tsx — FOUND (committed c5ccfb2)
- [x] npx tsc --noEmit — 0 errors in new files (pre-existing test + EventPDFGenerator errors unrelated)
- [x] DayOfDashboard has 4 tabs: Check-In, Roster, Incidents, Headcount
- [x] CheckInScanner uses html5-qrcode library
- [x] IncidentForm has offline Dexie support with toast feedback
- [x] Self-service page returns no medical data (FERPA compliant)
- [x] Service worker has 3 new event API caching rules

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
