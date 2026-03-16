---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "03"
subsystem: ui
tags: [react, tanstack-query, framer-motion, optimistic-update, tailwind, documents, compliance]

requires:
  - phase: 21-02
    provides: eventDocumentService + 4 API routes (documents, completions, reminders, compliance)

provides:
  - useEventDocuments.ts with 10 TanStack Query hooks (requirements, matrix, toggle, reminders, CRUD, compliance)
  - DocumentRequirementDrawer.tsx: side drawer for create/edit document requirements
  - DocumentMatrix.tsx: participant x document grid with clickable completion cells + optimistic update
  - ComplianceChecklist.tsx: expandable list with status badges, assignee, file URL, import defaults
  - EventDocumentsTab.tsx: full replacement (3 sub-tabs, progress bar, stats header)

affects:
  - 21-04-PLAN and beyond — DocumentMatrix pattern reusable for group-completion views
  - EventProjectTabs.tsx — documents tab now fully functional

tech-stack:
  added: []
  patterns:
    - Optimistic update in useToggleCompletion — cancelQueries, setQueryData, revert on error
    - Sub-tabs managed via local useState (not URL params — keeps parent URL clean)
    - refetchInterval 30s on useDocumentMatrix for day-of live updates
    - InlineEditor pattern in ComplianceChecklist (expand/collapse AnimatePresence height animation)
    - useToast(toast) for success/error feedback — toast(message, variant) API

key-files:
  created:
    - src/lib/hooks/useEventDocuments.ts
    - src/components/events/documents/DocumentRequirementDrawer.tsx
    - src/components/events/documents/DocumentMatrix.tsx
    - src/components/events/documents/ComplianceChecklist.tsx
  modified:
    - src/components/events/EventDocumentsTab.tsx

key-decisions:
  - "useToggleCompletion uses optimistic update pattern: cancelQueries, setQueryData immediately, revert on error — same approach as cart optimistic updates"
  - "ComplianceChecklist fetches org users from /api/settings/users for assignee dropdown — fetchApi returns array directly (not {users: array})"
  - "useToast API is toast(message, variant) not addToast({type, title}) — fixed during TS verification"
  - "UpsertComplianceItemInput extended with optional eventProjectId and sortOrder fields for create path"
  - "Lucide icons do not accept title prop — replaced with aria-label for accessibility"

patterns-established:
  - "InlineEditor in ComplianceChecklist: AnimatePresence with height:0 -> auto for expand-collapse, state managed as editingId string"
  - "Matrix filter bar: local state (all/incomplete/complete) + search, useMemo for derived filtered list"
  - "Sub-tab crossfade: AnimatePresence mode='wait' + tabContent variant from animations.ts"
  - "pendingCells: Set<string> pattern for tracking individual async cell operations"

requirements-completed: [DOC-01, DOC-02, DOC-03]

duration: 7min
completed: 2026-03-15
---

# Phase 21 Plan 03: Documents Tab UI Summary

**Participant x document completion matrix with clickable cells, optimistic toggle, reminder dispatch, compliance checklist with inline editor and defaults import — replacing placeholder EventDocumentsTab stub**

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-03-15T23:24:00Z
- **Completed:** 2026-03-15T23:31:00Z
- **Tasks:** 2
- **Files created:** 5 (4 new + 1 replaced)

## Accomplishments

- 10 TanStack Query hooks with proper staleTime, refetchInterval, and optimistic update rollback
- DocumentMatrix renders participant rows x requirement columns with green-100/red-50 cell coloring, filter bar (all/incomplete/complete), name search, and "Send Reminders (N)" button
- ComplianceChecklist: expand-to-edit inline form with AnimatePresence height animation, org user dropdown for assignee, import defaults from API, per-item delete
- EventDocumentsTab replaces placeholder entirely — header progress bar, 3 sub-tabs (Requirements/Completion/Compliance), staggered list animation for requirements

## Task Commits

1. **Task 1: Create TanStack Query hooks and DocumentRequirementDrawer** - `bd2fa1e` (feat)
2. **Task 2: Build DocumentMatrix, ComplianceChecklist, and replace EventDocumentsTab** - `11d9fed` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/hooks/useEventDocuments.ts` — 10 hooks: useDocumentRequirements, useDocumentMatrix, useToggleCompletion (optimistic), useSendReminders, useCreateDocumentRequirement, useUpdateDocumentRequirement, useDeleteDocumentRequirement, useComplianceItems, useUpsertComplianceItem, useDeleteComplianceItem
- `src/components/events/documents/DocumentRequirementDrawer.tsx` — DetailDrawer with label, type dropdown, description, due date, required toggle. Save/Cancel footer.
- `src/components/events/documents/DocumentMatrix.tsx` — Participant x document grid table, clickable cells with optimistic toggle, filter bar, send reminders, skeleton loading, empty state
- `src/components/events/documents/ComplianceChecklist.tsx` — Expandable compliance items list, inline editor, status badges (NOT_STARTED/IN_PROGRESS/COMPLETE), assignee from org users, import defaults CTA
- `src/components/events/EventDocumentsTab.tsx` — Full replacement: header stats + progress bar, 3 sub-tabs with animated crossfade, requirements list with type badges and edit/delete actions

## Decisions Made

- `useToggleCompletion` implements optimistic update: calls `cancelQueries`, immediately patches cache via `setQueryData`, rolls back via `onError` context — provides instant UI feedback for day-of staff use
- `ComplianceChecklist` fetches org users once on mount from `/api/settings/users?limit=100` — non-critical, failure silently produces empty assignee dropdown
- Toast API is `toast(message, variant)` not `addToast({type, title})` — corrected during TypeScript verification
- `UpsertComplianceItemInput` extended with `eventProjectId?: string` and `sortOrder?: number` to support InlineEditor create path
- Lucide icon `title` prop removed — `aria-label` used instead for accessibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Toast API usage**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Code used `addToast({ type, title })` but the project Toast API is `toast(message, variant)` — 3 TS2339 errors
- **Fix:** Replaced all `addToast` calls with `toast(message, variant)` across DocumentMatrix, ComplianceChecklist, and EventDocumentsTab
- **Files modified:** DocumentMatrix.tsx, ComplianceChecklist.tsx, EventDocumentsTab.tsx
- **Verification:** TypeScript check passed with no new errors
- **Committed in:** 11d9fed (Task 2 commit)

**2. [Rule 1 - Bug] Removed invalid `title` attribute from Lucide icons**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Lucide SVG icons do not accept `title` prop — TS2322 errors in EventDocumentsTab
- **Fix:** Replaced `title="..."` with `aria-label="..."` on AlertCircle and Check icons
- **Files modified:** EventDocumentsTab.tsx
- **Verification:** TypeScript check passed
- **Committed in:** 11d9fed (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added eventProjectId to UpsertComplianceItemInput**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** InlineEditor passes `eventProjectId` in the data object to `onSave`, but the hook type didn't include that field — TS2353 error
- **Fix:** Extended `UpsertComplianceItemInput` with optional `eventProjectId` and `sortOrder` fields in useEventDocuments.ts
- **Files modified:** useEventDocuments.ts
- **Verification:** TypeScript check passed
- **Committed in:** 11d9fed (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug: wrong API, 1 bug: invalid prop, 1 missing critical: incomplete type)
**Impact on plan:** All auto-fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered

None beyond the three auto-fixed TypeScript issues documented above.

## User Setup Required

None - no external service configuration required. All components use existing API routes from Phase 21-02.

## Next Phase Readiness

- Documents tab fully functional (DOC-01, DOC-02, DOC-03)
- useEventDocuments hooks ready for any future documents-related features
- ComplianceChecklist and DocumentMatrix patterns established for similar grid/list views
- Ready for Plan 04 (Groups) — same TanStack Query + component pattern applies

## Self-Check: PASSED

- FOUND: src/lib/hooks/useEventDocuments.ts
- FOUND: src/components/events/documents/DocumentRequirementDrawer.tsx
- FOUND: src/components/events/documents/DocumentMatrix.tsx
- FOUND: src/components/events/documents/ComplianceChecklist.tsx
- FOUND: src/components/events/EventDocumentsTab.tsx
- FOUND commit bd2fa1e: feat(21-03): add TanStack Query hooks and DocumentRequirementDrawer
- FOUND commit 11d9fed: feat(21-03): build DocumentMatrix, ComplianceChecklist, and replace EventDocumentsTab

---
*Phase: 21-documents-groups-communication-and-day-of-tools*
*Completed: 2026-03-15*
