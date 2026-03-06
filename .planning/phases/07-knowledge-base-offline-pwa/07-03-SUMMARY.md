---
phase: 07-knowledge-base-offline-pwa
plan: 03
subsystem: offline, pwa, ui
tags: [dexie, indexeddb, offline-sync, service-worker, react-hooks, tanstack-query, framer-motion]

# Dependency graph
requires:
  - phase: 07-02
    provides: Service worker caching strategy for read-path; manifest and offline fallback page
  - phase: 02-core-tickets
    provides: Maintenance ticket API routes (POST /api/maintenance/tickets, PATCH /tickets/[id], etc.)
provides:
  - Dexie IndexedDB database (lionheart-offline-v1) with offlineTickets, mutationQueue, cachedAssets tables
  - Offline mutation queue with enqueueOfflineMutation, drainQueue, retry tracking
  - Background sync engine (syncOfflineData) with applyMutation routing 6 mutation types
  - Conflict resolution: last-write-wins (status), merge-append (comments)
  - useConnectivity hook for real-time online/offline detection
  - useOfflineQueue hook with reactive queue count via useLiveQuery
  - ConnectivityIndicator: always-visible 4-state header badge (online/offline/syncing/queued)
  - OfflineSyncStatus: post-sync result panel with auto-dismiss and retry
  - TicketDetailOfflineWrapper: render-prop for offline-aware ticket mutations
  - Offline ticket submission: queues to IndexedDB with OFFLINE- temp number
  - MyRequestsGrid offline fallback: IndexedDB via useLiveQuery when network is down
  - TicketCard: Pending Sync amber badge for local-only tickets
  - DashboardLayout: auto-sync on online transition
  - Maintenance page: cacheAssignedTickets on mount to prime IndexedDB
affects:
  - phase: 04-assets-qr-pm (offline asset lookup relies on cachedAssets table)

# Tech tracking
tech-stack:
  added:
    - dexie 4.3.0 (IndexedDB ORM with full TypeScript types)
    - dexie-react-hooks 4.2.0 (useLiveQuery for reactive IndexedDB)
  patterns:
    - Offline mutation queue: enqueue when !navigator.onLine, drain on 'online' event
    - Dexie upsert pattern: findFirst by natural key, then update-or-add (avoids Dexie UpdateSpec type issue with array fields)
    - useLiveQuery with explicit TDefault generic: useLiveQuery<T, TDefault>(fn, deps, default)
    - Render-prop pattern for offline-aware components (TicketDetailOfflineWrapper)
    - Temp ID pattern: offline-created tickets use 'temp-{timestamp}' IDs; updateTempIdReferences swaps to real ID after sync

key-files:
  created:
    - src/lib/offline/db.ts
    - src/lib/offline/queue.ts
    - src/lib/offline/sync.ts
    - src/lib/offline/conflicts.ts
    - src/hooks/useConnectivity.ts
    - src/hooks/useOfflineQueue.ts
    - src/components/maintenance/ConnectivityIndicator.tsx
    - src/components/maintenance/OfflineSyncStatus.tsx
    - src/components/maintenance/TicketDetailOfflineWrapper.tsx
  modified:
    - src/components/DashboardLayout.tsx
    - src/components/maintenance/MyRequestsGrid.tsx
    - src/components/maintenance/SubmitRequestWizard.tsx
    - src/components/maintenance/TicketCard.tsx
    - src/app/maintenance/page.tsx
    - package.json

key-decisions:
  - "dexie-react-hooks useLiveQuery requires explicit TDefault generic for 3-arg form: useLiveQuery<number, number>(fn, deps, 0)"
  - "Dexie update() requires Partial (not full object) — destructure id out before calling update(existing.id, updateFields)"
  - "offline/sync.ts imported in DashboardLayout for auto-sync on reconnect; uses window online event via useConnectivity"
  - "cacheAssignedTickets called on maintenance page mount (not a dedicated layout) since no layout.tsx exists in /maintenance"
  - "TicketCard._isLocalOnly optional field enables Pending Sync badge without breaking existing ticket card rendering"

patterns-established:
  - "Offline data flow: useConnectivity -> useOfflineQueue -> enqueueOfflineMutation -> syncOfflineData on reconnect"
  - "IndexedDB fallback in list views: useLiveQuery runs in parallel with TanStack Query; shown when !isOnline || query error"
  - "Sync trigger location: DashboardLayout useEffect watches isOnline transitions (false->true) to auto-drain queue"

requirements-completed: [OFFLINE-02, OFFLINE-03, OFFLINE-04, OFFLINE-05, OFFLINE-06, OFFLINE-07, OFFLINE-08, OFFLINE-09]

# Metrics
duration: 10min
completed: 2026-03-06
---

# Phase 7 Plan 03: Offline Queue & Connectivity Indicator Summary

**Dexie IndexedDB mutation queue, background sync engine with last-write-wins conflict resolution, and always-visible 4-state connectivity indicator enabling full offline ticket create/update/labor/checklist operations**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-06T17:16:10Z
- **Completed:** 2026-03-06T17:26:00Z
- **Tasks:** 2
- **Files modified:** 15 (9 created, 6 modified)

## Accomplishments

- Dexie v4 database with 3 tables: offlineTickets, mutationQueue, cachedAssets — all with indexed fields for fast queries
- Full sync engine: 6 mutation types (TICKET_CREATE, STATUS_UPDATE, LABOR_LOG, COST_LOG, CHECKLIST_TOGGLE, COMMENT_ADD) replay in FIFO order with temp ID replacement for newly-created offline tickets
- ConnectivityIndicator in every page header: online (green wifi), offline (amber pill), syncing (blue spin), queued (orange count) — animated with Framer Motion AnimatePresence
- Technician can submit a ticket offline: stored in IndexedDB with OFFLINE- number, queued for sync, shows "Ticket Queued for Sync" confirmation
- MyRequestsGrid falls back to IndexedDB via useLiveQuery when offline — shows cached tickets with queue count banner
- DashboardLayout auto-triggers syncOfflineData when transitioning from offline → online

## Task Commits

1. **Task 1: Dexie schema, mutation queue, sync engine, conflict resolution** - `0cd6e0d` (feat)
2. **Task 2: Connectivity indicator, offline UI, sync trigger wiring** - `a257bf5` (feat)

## Files Created/Modified

- `src/lib/offline/db.ts` - Dexie OfflineDatabase with offlineTickets, mutationQueue, cachedAssets tables
- `src/lib/offline/queue.ts` - enqueueOfflineMutation, getPendingMutations, markMutationSyncing/Failed, updateTempIdReferences
- `src/lib/offline/sync.ts` - cacheAssignedTickets, syncOfflineData, applyMutation (routes 6 mutation types to correct API endpoints)
- `src/lib/offline/conflicts.ts` - resolveStatusConflict (last-write-wins), resolveCommentConflict (merge-append)
- `src/hooks/useConnectivity.ts` - online/offline detection via window events
- `src/hooks/useOfflineQueue.ts` - offline-aware mutation wrapper with reactive queue count
- `src/components/maintenance/ConnectivityIndicator.tsx` - 4-state animated header badge
- `src/components/maintenance/OfflineSyncStatus.tsx` - post-sync result panel with auto-dismiss
- `src/components/maintenance/TicketDetailOfflineWrapper.tsx` - render-prop for offline-aware mutations
- `src/components/DashboardLayout.tsx` - ConnectivityIndicator + auto-sync on reconnect
- `src/components/maintenance/MyRequestsGrid.tsx` - IndexedDB fallback with offline banner
- `src/components/maintenance/SubmitRequestWizard.tsx` - offline queue path with confirmation screen
- `src/components/maintenance/TicketCard.tsx` - Pending Sync badge for local-only tickets
- `src/app/maintenance/page.tsx` - cacheAssignedTickets on mount
- `package.json` - dexie 4.3.0 + dexie-react-hooks 4.2.0

## Decisions Made

- dexie-react-hooks is a separate package from dexie v4 core — installed separately (not bundled)
- Dexie update() requires a partial UpdateSpec type, not a full object — destructure id out before calling update()
- useLiveQuery 3-arg form requires explicit TDefault generic: `useLiveQuery<number, number>(fn, deps, 0)` to satisfy TypeScript
- cacheAssignedTickets fires from maintenance page mount (not a separate layout) since /maintenance has no layout.tsx
- TicketCard gets optional `_isLocalOnly` field to show Pending Sync badge without breaking existing ticket rendering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing dexie-react-hooks package**
- **Found during:** Task 1 (useOfflineQueue.ts)
- **Issue:** `useLiveQuery` is not exported from `dexie` v4 core — it lives in the separate `dexie-react-hooks` package
- **Fix:** `npm install dexie-react-hooks --save`
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript compile passes
- **Committed in:** 0cd6e0d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Dexie update() UpdateSpec type mismatch**
- **Found during:** Task 1 (sync.ts)
- **Issue:** Passing full OfflineTicket object to `db.offlineTickets.update()` fails TypeScript because array-type fields (pmChecklistItems, pmChecklistDone) don't satisfy the Dexie UpdateSpec indexed type
- **Fix:** Destructure `id` out of the object before calling update: `const { id: _id, ...updateFields } = ticket; await db.offlineTickets.update(id, updateFields)`
- **Files modified:** src/lib/offline/sync.ts
- **Verification:** TypeScript compile passes
- **Committed in:** 0cd6e0d (Task 1 commit)

**3. [Rule 1 - Bug] Fixed useLiveQuery TypeScript error (3-arg overload requires TDefault generic)**
- **Found during:** Task 1 (useOfflineQueue.ts)
- **Issue:** `useLiveQuery<number>(fn, [], 0)` gives TS2554 (Expected 1-2 args) because the 3-arg overload is typed as `useLiveQuery<T, TDefault>` requiring two generics
- **Fix:** Changed to `useLiveQuery<number, number>(fn, [], 0)`
- **Files modified:** src/hooks/useOfflineQueue.ts
- **Verification:** TypeScript compile passes
- **Committed in:** 0cd6e0d (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 2 type bugs)
**Impact on plan:** All auto-fixes required for TypeScript correctness. No scope changes.

## Issues Encountered

None beyond the TypeScript issues above, which were resolved inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 7 plans (01, 02, 03) are now complete
- Phase 7 delivers: knowledge base, PWA manifest + service worker caching, IndexedDB mutation queue, background sync, connectivity indicator
- Technicians have full offline capability: cached ticket reads, offline ticket creation, status/labor/checklist mutations all queued and auto-synced on reconnect

---
*Phase: 07-knowledge-base-offline-pwa*
*Completed: 2026-03-06*
