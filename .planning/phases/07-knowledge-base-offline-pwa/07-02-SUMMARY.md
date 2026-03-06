---
phase: 07-knowledge-base-offline-pwa
plan: 02
subsystem: infra
tags: [pwa, service-worker, serwist, offline, manifest, caching]

# Dependency graph
requires:
  - phase: 07-01
    provides: Knowledge base articles and maintenance module foundation
provides:
  - PWA installable app with standalone display mode
  - Service worker with 6 cache strategies (NetworkFirst/CacheFirst/StaleWhileRevalidate)
  - Offline fallback page at /offline
  - OfflineBadge component for Plan 07-03
affects:
  - 07-03 (offline mutation queue builds on service worker cache)

# Tech tracking
tech-stack:
  added: ["@serwist/next", "serwist"]
  patterns:
    - "withSerwist wraps next.config.ts (disabled in dev to prevent stale cache)"
    - "Service worker at src/app/sw.ts compiled by serwist build plugin"
    - "SVG icons in public/icons/ (no binary PNG needed for manifest)"
    - "Client component ServiceWorkerRegistration.tsx registers /sw.js on mount"
    - "ExpirationPlugin from serwist (not cacheExpiration object literal) for cache TTL"

key-files:
  created:
    - src/app/sw.ts
    - public/manifest.json
    - public/icons/icon-192.svg
    - public/icons/icon-512.svg
    - public/icons/apple-touch-icon.svg
    - src/app/offline/page.tsx
    - src/components/ServiceWorkerRegistration.tsx
    - src/components/maintenance/OfflineBadge.tsx
  modified:
    - next.config.ts
    - src/middleware.ts
    - src/app/layout.tsx
    - package.json

key-decisions:
  - "SVG icons instead of PNG — browsers accept SVG in manifests, avoids binary generation dependency"
  - "Service worker disabled in development (disable: process.env.NODE_ENV === 'development') — prevents stale cache during development"
  - "ExpirationPlugin class from serwist (not cacheExpiration object literal) — correct Serwist v9 API"
  - "Six cache strategies: tickets NetworkFirst 5s, assets NetworkFirst, knowledge-base StaleWhileRevalidate, API NetworkFirst 10s, static CacheFirst 30d, next-static CacheFirst 365d"
  - "/sw.js, /manifest.json, /offline, /icons/* bypass auth middleware — static files must be publicly accessible"

patterns-established:
  - "PWA manifest shortcut pattern: /maintenance/submit and /maintenance/tickets as app shortcuts"
  - "OfflineBadge: text-xs flex items-center gap-1 with WifiOff icon and Cached text"

requirements-completed: [OFFLINE-01, OFFLINE-02, OFFLINE-07]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 7 Plan 02: PWA Setup Summary

**@serwist/next service worker with 6 cache strategies, standalone manifest, offline fallback, and OfflineBadge — app is now installable as a PWA with maintenance tickets cached for offline access**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T17:15:37Z
- **Completed:** 2026-03-06T17:21:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Installed `@serwist/next` and `serwist`, wired into next.config.ts with `withSerwist` (dev disabled)
- Service worker at `src/app/sw.ts` with 6 caching rules: maintenance tickets/assets (NetworkFirst), knowledge base (StaleWhileRevalidate), other API (NetworkFirst), static assets (CacheFirst 30d), Next.js chunks (CacheFirst 365d)
- PWA manifest with standalone display, theme color, shortcuts to New Ticket and My Tickets
- SVG icons for 192, 512, and 180px with Lionheart L monogram
- `/offline` static fallback page rendered by service worker when user navigates to an uncached page offline
- `OfflineBadge` component ready for Plan 07-03 consumption
- Middleware bypasses auth for `/sw.js`, `/manifest.json`, `/offline`, `/icons/*`
- `npm run build` completes cleanly with `/offline` page in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Install serwist, configure Next.js PWA build, and service worker caching strategy** - `f8f1e0b` (feat)
2. **Task 2: PWA manifest, icons, offline fallback page, and service worker registration** - `12128d0` (feat)

## Files Created/Modified

- `next.config.ts` - Wrapped with withSerwistInit (swSrc: src/app/sw.ts, swDest: public/sw.js)
- `src/app/sw.ts` - Service worker with 6 caching rules and offline fallback to /offline
- `src/middleware.ts` - Added /sw.js, /manifest.json, /offline, /icons/* to public path bypass
- `package.json` - Added @serwist/next and serwist dependencies
- `public/manifest.json` - PWA manifest with name, display:standalone, shortcuts, icons
- `public/icons/icon-192.svg` - 192x192 L monogram icon
- `public/icons/icon-512.svg` - 512x512 L monogram icon
- `public/icons/apple-touch-icon.svg` - 180x180 Apple touch icon
- `src/app/layout.tsx` - Added manifest, themeColor, appleWebApp metadata + ServiceWorkerRegistration
- `src/app/offline/page.tsx` - Static offline fallback page with glassmorphism card and Go to Maintenance CTA
- `src/components/ServiceWorkerRegistration.tsx` - Client component registering /sw.js on mount
- `src/components/maintenance/OfflineBadge.tsx` - Small cached-data badge for Plan 07-03

## Decisions Made

- SVG icons instead of PNG — browsers accept SVG in manifests on modern platforms; avoids binary generation complexity
- Service worker disabled in development to prevent stale cache interference during coding
- Used `ExpirationPlugin` class (not `cacheExpiration` object literal) — correct Serwist v9 plugin API discovered via TypeScript error
- Offline page is a static server component (no 'use client') so it can be pre-cached by the service worker as simple HTML

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ExpirationPlugin API usage**
- **Found during:** Task 1 (service worker creation)
- **Issue:** Plan specified `plugins: [{ cacheExpiration: { maxAgeSeconds: ... } }]` but Serwist v9 requires `ExpirationPlugin` class instances
- **Fix:** Imported `ExpirationPlugin` from serwist and used `new ExpirationPlugin({ maxAgeSeconds: ... })` in plugin arrays
- **Files modified:** src/app/sw.ts
- **Verification:** TypeScript compiled cleanly after fix
- **Committed in:** f8f1e0b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential API correction; no scope change.

## Issues Encountered

- `git stash` during verification inadvertently reverted `layout.tsx` (stash stored the pre-Task2 version); restored by re-writing the file. No data loss.

## User Setup Required

None - no external service configuration required. Service worker activates on first production visit.

## Next Phase Readiness

- Service worker and cache infrastructure fully operational
- `OfflineBadge` component exported and ready for Plan 07-03 IndexedDB mutation queue
- Offline fallback page pre-cached via Serwist precache manifest
- Plan 07-03 can now build the IndexedDB queue and sync engine on top of this caching foundation

---
*Phase: 07-knowledge-base-offline-pwa*
*Completed: 2026-03-06*
