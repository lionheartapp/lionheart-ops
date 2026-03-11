---
status: awaiting_human_verify
trigger: "facilities sidebar gradient indicator never appears next to active nav item"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: TypeScript compiles clean, logic traced through all scenarios
expecting: Human verification that indicator now appears on /maintenance/* pages
next_action: await human verification

## Symptoms

expected: Purple-to-pink gradient vertical bar (w-0.5) appears on left side of active facilities sub-nav item, slides between items on navigation
actual: White track line (bg-white/10) visible. Text highlights correctly. Gradient indicator bar ALWAYS invisible — opacity never becomes 1. Happens on ALL maintenance routes.
errors: No console errors
reproduction: Log in, navigate to any /maintenance/* page, look at facilities sub-nav — no gradient bar visible despite correct text highlighting
started: Never worked correctly despite 4+ fix attempts

## Eliminated

- hypothesis: Timing issue (50ms / 300ms timeouts too early)
  evidence: The timeouts fire correctly, but at the time they fire, the active nav item doesn't exist yet in the DOM (permissions not loaded yet). positionIndicator finds no active element, sets opacity=0, returns true, marks facilityMeasuredRef=true. The real issue is what happens AFTER permissions arrive.
  timestamp: 2026-03-06

- hypothesis: overflow-hidden clips the indicator
  evidence: Container correctly shows track line (bg-white/10) which is also absolutely positioned. Both elements are within bounds once container has height. Not the cause.
  timestamp: 2026-03-06

- hypothesis: ref callback / framer-motion timing (prior fix attempts)
  evidence: The ref callback correctly sets facilityContainerMounted=true. The effect fires at the right time. The issue is that the active nav item conditionally rendered by canManageMaintenance doesn't exist yet when effect first fires.
  timestamp: 2026-03-06

## Evidence

- timestamp: 2026-03-06T00:00:30Z
  checked: Sidebar.tsx — facilities nav rendering (lines 716-860)
  found: Most nav items (Work Orders, Assets, PM Calendar, Analytics, Compliance, Board Report, Knowledge Base) are wrapped in {canManageMaintenance && (...)}. Only the Dashboard link is unconditional. canManageMaintenance defaults to false via `perms?.canManageMaintenance ?? false`.
  implication: On initial render, only the Dashboard link exists. If current route is NOT /maintenance exactly, querySelector('[data-facility-active="true"]') returns null.

- timestamp: 2026-03-06T00:00:35Z
  checked: usePermissions hook (src/lib/hooks/usePermissions.ts)
  found: Returns useQuery backed by /api/auth/permissions with staleTime: 10 minutes. On fresh component mount with no cache, data is undefined until fetch completes.
  implication: Async. Takes a network round-trip before canManageMaintenance becomes true.

- timestamp: 2026-03-06T00:00:40Z
  checked: positionIndicator effect dependency array (was line 330, now line 352)
  found: Original deps: [facilitiesOpen, facilityContainerMounted, pathname]. canManageMaintenance and canClaimMaintenance were NOT dependencies.
  implication: When permissions arrive and canManageMaintenance becomes true, React re-renders the sidebar (new nav items appear in DOM), but the positioning effect does NOT re-run because none of its declared deps changed.

- timestamp: 2026-03-06T00:00:45Z
  checked: positionIndicator logic when activeEl is null (lines 292-295)
  found: When no active element found, indicator.style.opacity = '0', return true. t1Succeeded becomes true, facilityMeasuredRef.current becomes true.
  implication: The effect successfully "completes" with no active element found. When permissions load later and the correct nav item appears, the effect doesn't re-run, so the indicator stays hidden.

## Resolution

root_cause: The positioning effect dependency array was [facilitiesOpen, facilityContainerMounted, pathname]. Most facilities nav items are conditionally rendered by {canManageMaintenance && (...)} — an async permission query. On initial mount, all conditional items default to hidden. The t1 timeout fires, finds no active element for the current /maintenance/analytics route, sets opacity=0, marks facilityMeasuredRef=true, and returns. When permissions load and canManageMaintenance becomes true, the nav items appear in DOM (including the active one), but the effect NEVER re-runs because neither canManageMaintenance nor canClaimMaintenance were in the dependency array.

fix: |
  1. Moved usePermissions() call and derived permission booleans (canManageWorkspace, canManageMaintenance, canClaimMaintenance, canSubmitMaintenance) to BEFORE the useEffect (lines 260-266), removing the duplicate declarations that were at the old location (old line ~566).
  2. Added canManageMaintenance and canClaimMaintenance to the effect dependency array (line 352).
  3. Preserved the alreadyMeasured flag pattern: when the effect re-runs due to a pathname change (user navigating), alreadyMeasured=true causes t1 to use animate=true (CSS slide transition). When re-running due to permissions loading, alreadyMeasured=false causes t1 to use animate=false (snap into position).
  4. Simplified t2 fallback: only runs if t1Succeeded=false, always uses animate=false as a safe snap fallback.

verification: TypeScript compiles clean (npx tsc --noEmit — zero errors)
files_changed:
  - src/components/Sidebar.tsx
