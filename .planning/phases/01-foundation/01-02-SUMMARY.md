---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [react, nextjs, framer-motion, tailwind, maintenance, module-registry]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: "13 MAINTENANCE_* permission constants, MAINTENANCE_HEAD and MAINTENANCE_TECHNICIAN roles in DEFAULT_ROLES"
provides:
  - Maintenance module entry in MODULE_REGISTRY (AddOnsTab) with emerald gradient and campus scope
  - MaintenanceTab type exported from Sidebar.tsx
  - Support section in sidebar main nav with role-adaptive Facilities/Work Orders/My Requests links
  - Maintenance permission flags (canManageMaintenance, canClaimMaintenance, canSubmitMaintenance) in permissions API + usePermissions hook
  - /maintenance page with DashboardLayout, ModuleGate, role-based default tab, campus selector
  - MaintenanceDashboard.tsx — command center shell with 8-status bar chart, 9 panels, zero-count stat cards
  - MyRequestsView.tsx — empty state with disabled Submit Request CTA
  - MaintenanceSkeleton.tsx — loading skeleton matching dashboard layout
affects: [02-ticket-engine, 03-kanban-ai, 04-advanced-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suspense boundary pattern: wrap useSearchParams() consumers in <Suspense> at page level to satisfy Next.js static generation"
    - "Role-adaptive nav pattern: derive canManage/canClaim/canSubmit from permissions API, show/hide nav items conditionally"
    - "Maintenance tab active color: emerald-500 border / emerald-700 text (vs primary-500 for Athletics)"

key-files:
  created:
    - src/app/maintenance/page.tsx
    - src/components/maintenance/MaintenanceDashboard.tsx
    - src/components/maintenance/MyRequestsView.tsx
    - src/components/maintenance/MaintenanceSkeleton.tsx
  modified:
    - src/components/settings/AddOnsTab.tsx
    - src/components/Sidebar.tsx
    - src/lib/hooks/usePermissions.ts
    - src/lib/queries.ts
    - src/app/api/auth/permissions/route.ts

key-decisions:
  - "Maintenance nav uses simple links (not secondary sidebar panel) — no campus dispatching needed since permissions gate which links appear"
  - "Permissions API extended in-place rather than a separate endpoint — keeps all auth-level flags co-located"
  - "Emerald color theme for maintenance (vs amber for athletics) — distinct visual identity for the module"

patterns-established:
  - "Module page pattern: auth guard + DashboardLayout + ModuleGate + role-based tab default + campus selector (same as Athletics)"
  - "Suspense wrapper for useSearchParams: separate inner component (MaintenanceContent) wrapped at page default export"
  - "Support section in sidebar: text header + role-filtered link list, no secondary panel"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 1 Plan 02: Maintenance Module Navigation Shell Summary

**Maintenance module wired into platform: emerald-themed AddOns card, role-adaptive sidebar Support section, and /maintenance landing page with command center dashboard shell (9 panels) and My Requests empty state**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T00:43:52Z
- **Completed:** 2026-03-06T00:49:45Z
- **Tasks:** 2 auto (Task 3 is checkpoint — human verification pending)
- **Files modified:** 9 (5 modified, 4 created)

## Accomplishments
- Added 'maintenance' MODULE_REGISTRY entry to AddOnsTab with emerald gradient (from-emerald-500 to-teal-600), campus scope, and Wrench icon — generic campus config modal handles toggle without any additional code
- Extended permissions API (`/api/auth/permissions`) with 3 new maintenance checks (canManageMaintenance, canClaimMaintenance, canSubmitMaintenance) using existing `can()` helpers; updated usePermissions hook interface and queries.ts type to match
- Added Support section to sidebar main nav with role-adaptive links: Head/Admin sees Facilities + Work Orders, Technician sees Facilities + My Requests, Teacher/Staff sees Facilities only — all hidden when module disabled
- Created 4 new files: MaintenanceSkeleton (animate-pulse layout matching 9-panel dashboard), MaintenanceDashboard (command center with 8-status bar chart, alerts, technician workload, PM calendar, cost summary, compliance panels), MyRequestsView (empty state with emerald icon + disabled CTA), and /maintenance page

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Maintenance to MODULE_REGISTRY and wire sidebar navigation** - `e293a33` (feat)
2. **Task 2: Create /maintenance page with role-based views and dashboard shell** - `4ad7358` (feat)

Task 3 (checkpoint:human-verify) — pending human approval

## Files Created/Modified
- `src/components/settings/AddOnsTab.tsx` - Added Wrench import + maintenance MODULE_REGISTRY entry (emerald, campus scope)
- `src/components/Sidebar.tsx` - Added Wrench/ClipboardList imports, MaintenanceTab export, useModuleEnabled('maintenance'), maintenance permission derivations, Support section with role-adaptive nav items
- `src/lib/hooks/usePermissions.ts` - Added canManageMaintenance, canClaimMaintenance, canSubmitMaintenance to Permissions interface
- `src/lib/queries.ts` - Updated fetchApi type for permissions endpoint to include 3 new boolean fields
- `src/app/api/auth/permissions/route.ts` - Added 3 maintenance permission checks to Promise.all, included in response
- `src/app/maintenance/page.tsx` - Full page: auth guard, DashboardLayout, ModuleGate, campus selector, role-based default tab, emerald tab styling, Suspense wrapper for useSearchParams
- `src/components/maintenance/MaintenanceDashboard.tsx` - Command center shell: 4 stat cards, 6 panels (status bar chart, activity, campus breakdown, urgent alerts, technician workload, PM calendar), 2 full-width panels (cost summary, compliance); all zero-count placeholder state with animations
- `src/components/maintenance/MyRequestsView.tsx` - Empty state: emerald Wrench icon in rounded-2xl bg-emerald-50 container, heading, description, disabled Submit Request CTA with coming-soon tooltip
- `src/components/maintenance/MaintenanceSkeleton.tsx` - Animate-pulse skeleton matching full dashboard layout (header, 4 stat cards, 6 panels, 2 bottom panels)

## Decisions Made
- Maintenance nav uses simple links (no secondary sidebar panel like Settings/Calendar/Athletics) — permissions gate which links appear, so no campus dispatch needed
- Extended existing `/api/auth/permissions` endpoint rather than creating a separate maintenance-permissions route — keeps all auth-level boolean flags co-located and avoids extra round-trip
- Emerald color theme (#059669 / emerald-500/teal-600) chosen for maintenance to distinguish from amber (athletics) and primary-blue (core nav)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped useSearchParams in Suspense boundary**
- **Found during:** Task 2 (build verification after creating /maintenance page)
- **Issue:** Next.js static generation threw error: "useSearchParams() should be wrapped in a suspense boundary at page '/maintenance'". Build exited with code 1.
- **Fix:** Extracted page body into `MaintenanceContent` inner component, wrapped default export `MaintenancePage` in `<Suspense>` with loading fallback. Pattern is identical to what any Next.js page using useSearchParams requires.
- **Files modified:** src/app/maintenance/page.tsx
- **Verification:** `npx next build --no-lint` passed cleanly after fix
- **Committed in:** 4ad7358 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking build error)
**Impact on plan:** Fix was required for Next.js static generation compatibility. No scope creep — same functionality, just correctly wrapped in Suspense.

## Issues Encountered
None beyond the auto-fixed Suspense boundary requirement above.

## User Setup Required
None — all changes are frontend-only. The maintenance module will appear in AddOns Settings once this code is deployed. Users need to enable it per campus via the AddOns tab to see the sidebar nav and access /maintenance.

## Next Phase Readiness
- Navigation shell fully operational — module appears in AddOns, sidebar nav shows when enabled, /maintenance page loads with correct role-based default tab
- All 4 components ready for Phase 2 to wire in real data (tickets API, kanban board, etc.)
- Permissions API is already returning maintenance flags so Phase 2 API routes can use `assertCan(userId, PERMISSIONS.MAINTENANCE_SUBMIT)` immediately
- Human verification (Task 3 checkpoint) pending — dev server must be started for visual review

## Self-Check: PASSED

- src/app/maintenance/page.tsx: FOUND
- src/components/maintenance/MaintenanceDashboard.tsx: FOUND
- src/components/maintenance/MyRequestsView.tsx: FOUND
- src/components/maintenance/MaintenanceSkeleton.tsx: FOUND
- src/components/settings/AddOnsTab.tsx: FOUND (maintenance entry added)
- src/components/Sidebar.tsx: FOUND (Support section added)
- src/lib/hooks/usePermissions.ts: FOUND (maintenance flags added)
- src/app/api/auth/permissions/route.ts: FOUND (maintenance checks added)
- Commit e293a33 (Task 1): FOUND
- Commit 4ad7358 (Task 2): FOUND

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
