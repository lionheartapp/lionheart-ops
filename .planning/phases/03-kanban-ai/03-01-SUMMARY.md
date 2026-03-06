---
phase: 03-kanban-ai
plan: 01
subsystem: ui
tags: [dnd-kit, kanban, react, drag-and-drop, maintenance, tailwind]

# Dependency graph
requires:
  - phase: 02-core-tickets
    provides: WorkOrderTicket type, WorkOrdersView, WorkOrdersFilters, HoldReasonInlineForm, QACompletionModal
provides:
  - 6-column Kanban board with dnd-kit drag-and-drop
  - KanbanBoard, KanbanColumn, KanbanCard, TechnicianAssignPanel components
  - Board/table toggle in WorkOrdersView (board is default)
  - Gate modals for ON_HOLD and QA transitions
  - Client-safe transition map (maintenance-transitions.ts)
  - Fixed WorkOrdersFilters enums to match Prisma schema
affects: [03-02, 04-pm-scheduling, 06-reporting]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core ^6.x", "@dnd-kit/sortable ^8.x", "@dnd-kit/utilities ^3.x"]
  patterns:
    - "Client-safe transition map extracted from server service to avoid mjml/fs bundle pollution"
    - "KanbanBoard uses isBoardTransitionAllowed from maintenance-transitions.ts (not maintenanceTicketService.ts)"
    - "Optimistic DnD: onDragEnd patches localTickets state immediately for non-gated transitions, rolls back on error"
    - "Gate modals (ON_HOLD, QA) do NOT move card optimistically — wait for user to fill form"
    - "TechnicianAssignPanel each avatar is its own useDroppable with id=tech-{userId}"

key-files:
  created:
    - src/components/maintenance/KanbanBoard.tsx
    - src/components/maintenance/KanbanColumn.tsx
    - src/components/maintenance/KanbanCard.tsx
    - src/components/maintenance/TechnicianAssignPanel.tsx
    - src/lib/maintenance-transitions.ts
  modified:
    - src/components/maintenance/WorkOrdersView.tsx
    - src/components/maintenance/WorkOrdersFilters.tsx
    - src/components/maintenance/WorkOrdersTable.tsx

key-decisions:
  - "Client-safe maintenance-transitions.ts: importing from maintenanceTicketService.ts pulls in mjml/fs server deps into client bundle — created separate lightweight file"
  - "Board defaults to campus view (not all-campuses) for multi-campus orgs — matches expected behavior"
  - "localTickets state in KanbanBoard for optimistic updates rather than TanStack Query mutation (simpler for DnD)"
  - "Fixed enum mismatches: QA_REVIEW->QA, CARPENTRY->STRUCTURAL, PAINTING->CUSTODIAL_BIOHAZARD, CLEANING->IT_AV"

patterns-established:
  - "Server service server-only imports: never import maintenanceTicketService.ts from client components"
  - "Kanban DnD: DragOverlay renders KanbanCard with isOverlay=true for visual rotation; dragging card goes 40% opacity"
  - "Column validity: null=no drag active, true/false=valid/invalid for highlighting"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08]

# Metrics
duration: 25min
completed: 2026-03-06
---

# Phase 03 Plan 01: Kanban Board Summary

**6-column drag-and-drop Kanban board built with dnd-kit, wired into WorkOrdersView as default view with board/table toggle, gate modals for ON_HOLD/QA transitions, and technician drag-to-assign panel.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-06T03:55:00Z
- **Completed:** 2026-03-06T04:19:18Z
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Built full dnd-kit Kanban with 6 columns (BACKLOG, TODO, IN_PROGRESS, ON_HOLD, QA, DONE), DragOverlay, and closestCorners collision detection
- ON_HOLD drops show HoldReasonInlineForm gate modal; QA drops show QACompletionModal — card does NOT move optimistically before confirmation
- Non-gated valid transitions use optimistic localTickets state with rollback on error
- TechnicianAssignPanel provides drag-to-assign with per-tech droppable targets and emerald highlight on hover
- Board/table toggle preserves filter state; board is default view per plan spec
- Fixed WorkOrdersFilters enum mismatch (QA_REVIEW → QA, CARPENTRY → STRUCTURAL, PAINTING → CUSTODIAL_BIOHAZARD, CLEANING → IT_AV)
- Mobile: horizontal scroll with snap-x snap-mandatory, columns fill 85vw each

## Task Commits

1. **Task 1: Install dnd-kit and build Kanban components** - `dd61157` (feat)
2. **Task 2: Wire KanbanBoard into WorkOrdersView with board/table toggle** - `0c97bbf` (feat)

## Files Created/Modified

- `src/components/maintenance/KanbanBoard.tsx` — Main board: DndContext, 6 columns, DragOverlay, gate modals, view tabs (My Board/Campus/All), optimistic updates
- `src/components/maintenance/KanbanColumn.tsx` — Single droppable column with count badge, valid/invalid ring highlighting
- `src/components/maintenance/KanbanCard.tsx` — Draggable ticket card with useSortable, priority badge, category tag, location, tech avatar, age/photo/AI indicators
- `src/components/maintenance/TechnicianAssignPanel.tsx` — Row of droppable tech avatars for drag-to-assign
- `src/lib/maintenance-transitions.ts` — Client-safe BOARD_ALLOWED_TRANSITIONS map and isBoardTransitionAllowed() helper
- `src/components/maintenance/WorkOrdersView.tsx` — Added board/table toggle, KanbanBoard integration, default to board view
- `src/components/maintenance/WorkOrdersFilters.tsx` — Fixed enums to match Prisma schema
- `src/components/maintenance/WorkOrdersTable.tsx` — Added photos and aiAnalysis fields to WorkOrderTicket interface

## Decisions Made

- **Client-safe transition map:** maintenanceTicketService.ts transitively imports mjml (which requires Node.js `fs`) — importing it from a client component breaks the Next.js bundle. Created `maintenance-transitions.ts` with a plain JS object that mirrors the service's ALLOWED_TRANSITIONS. Must be kept in sync manually.
- **localTickets state for optimistic DnD:** chose component-local state over TanStack Query optimistic updates for simplicity — DnD state is ephemeral and the query cache is invalidated after every mutation anyway.
- **Board defaults to campus view:** when activeCampusId is set, the board auto-filters to that campus. Users can switch to My Board or All Campuses via the tab bar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted client-safe transition map from server service**
- **Found during:** Task 1 (KanbanBoard.tsx creation)
- **Issue:** Importing ALLOWED_TRANSITIONS from maintenanceTicketService.ts pulled mjml → mjml-parser-xml → requires `fs` node module — breaks Next.js client bundle with "Module not found: Can't resolve 'fs'"
- **Fix:** Created `src/lib/maintenance-transitions.ts` with a plain BOARD_ALLOWED_TRANSITIONS object and isBoardTransitionAllowed() helper. KanbanBoard imports from this file instead.
- **Files modified:** src/lib/maintenance-transitions.ts (created), src/components/maintenance/KanbanBoard.tsx (updated import)
- **Verification:** `npm run build` compiled successfully without fs error
- **Committed in:** dd61157 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — without it the client bundle would fail to build. No scope creep.

## Issues Encountered

- Next.js build had a pre-existing manifest file error on first two runs (`next-font-manifest.json`, `pages-manifest.json`). This resolved on the third build run — appears to be a race condition in the .next/ cache cleanup. Not related to our changes.

## Next Phase Readiness

- KanbanBoard is fully wired; 03-02 (AI Diagnostics) is already complete per git log
- Board/table toggle and gate modals are ready for end-user testing
- `maintenance-transitions.ts` must stay in sync with `maintenanceTicketService.ts` ALLOWED_TRANSITIONS if transitions are modified

## Self-Check: PASSED

- FOUND: src/components/maintenance/KanbanBoard.tsx
- FOUND: src/components/maintenance/KanbanCard.tsx
- FOUND: src/components/maintenance/KanbanColumn.tsx
- FOUND: src/components/maintenance/TechnicianAssignPanel.tsx
- FOUND: src/lib/maintenance-transitions.ts
- FOUND commit: dd61157 (Task 1)
- FOUND commit: 0c97bbf (Task 2)

---
*Phase: 03-kanban-ai*
*Completed: 2026-03-06*
