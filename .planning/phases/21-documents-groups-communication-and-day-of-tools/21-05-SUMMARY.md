---
phase: 21-documents-groups-communication-and-day-of-tools
plan: "05"
subsystem: logistics-groups-pdf
tags: [groups, drag-and-drop, pdf, activities, dietary, medical, ferpa, portal, phase-21]
dependency_graph:
  requires:
    - 21-04 (eventGroupService + group/activity/dietary-medical API routes)
    - 21-01 (EventGroup, EventGroupAssignment, EventActivityOption, EventActivitySignup models)
  provides:
    - useEventGroups.ts (TanStack Query hooks for all group/activity/dietary operations)
    - GroupDragBoard.tsx (DnD pool-to-groups assignment board)
    - GroupCard.tsx (droppable group with capacity bar and inline edit)
    - ParticipantCard.tsx (draggable participant with avatar and medical flag)
    - ActivityManager.tsx (activity CRUD with capacity and signup expansion)
    - DietaryMedicalReport.tsx (FERPA-gated aggregation view)
    - event-pdf-utils.ts (6 jsPDF generator functions)
    - EventPDFGenerator.tsx (2x3 grid format selector UI)
    - EventLogisticsTab.tsx (full replacement of placeholder with 6 sub-tabs)
    - GET /api/registration/[id]/groups (public portal group assignments endpoint)
    - PortalView.tsx updated with "Your Groups" section
  affects:
    - EventProjectTabs.tsx (now passes project prop to EventLogisticsTab)
    - Parent registration portal (new Groups section visible to parents)
tech_stack:
  added:
    - "@dnd-kit/core (already installed) — DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor"
    - "jspdf (already installed v4.2.0) — client-side PDF generation"
  patterns:
    - Pool-to-groups DnD using static slot pattern (max 20 groups) — avoids dynamic hook calls in loops
    - Dynamic jsPDF import in PDF generator — avoids SSR issues and code-splits the 500KB library
    - JsPDFConstructor type with cast-to-any at callsite — matches existing label-utils.ts pattern
    - legacyRole check for medical permissions (admin/super-admin) — consistent with codebase pattern
    - Public portal API (no auth) uses registrationId as access token — same as announcements pattern
key_files:
  created:
    - src/lib/hooks/useEventGroups.ts
    - src/components/events/groups/ParticipantCard.tsx
    - src/components/events/groups/GroupCard.tsx
    - src/components/events/groups/GroupDragBoard.tsx
    - src/components/events/groups/ActivityManager.tsx
    - src/components/events/groups/DietaryMedicalReport.tsx
    - src/lib/event-pdf-utils.ts
    - src/components/events/groups/EventPDFGenerator.tsx
    - src/app/api/registration/[id]/groups/route.ts
  modified:
    - src/components/events/EventLogisticsTab.tsx (full replacement of placeholder)
    - src/components/events/EventProjectTabs.tsx (pass project prop to logistics tab)
    - src/components/registration/PortalView.tsx (add "Your Groups" section)
decisions:
  - Static slot pattern for useGroupsWithAssignments — hooks cannot be called in loops, so 20 fixed slots handle up to 20 groups per type (sufficient for real-world use)
  - Dynamic jsPDF import in EventPDFGenerator — avoids 500KB SSR bundle hit, consistent with label-utils pattern
  - legacyRole check for medical access — admin/super-admin only, consistent with FERPA gate in dietary-medical API route
  - GroupAssignmentsSection uses raw fetch() not TanStack Query — portal is not a TanStack Query context (no QueryClient provider)
  - jsPDF cast-to-any at callsite — jsPDF's real constructor signature is richer than our minimal interface; same approach as codebase label-utils.ts
metrics:
  duration: "~14 minutes"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 12
---

# Phase 21 Plan 05: Logistics Tab UI — Groups, PDFs, and Portal Summary

**One-liner:** DnD group assignment board using @dnd-kit, 6 jsPDF printable formats, complete EventLogisticsTab replacement with 6 sub-tabs, and parent portal group assignments display.

## What Was Built

### Task 1: TanStack Query Hooks + Drag-and-Drop Board + Activity Manager

**src/lib/hooks/useEventGroups.ts:**
Complete hook library for the logistics UI:
- `useGroups(eventProjectId, type?)` — lists groups with assignment counts
- `useGroupAssignments(eventProjectId, groupId)` — assignments + unassigned pool for a group
- `useAssignToGroup / useRemoveFromGroup` — POST/DELETE mutations with dual query invalidation
- `useAutoAssign` — POST to auto-assign endpoint, invalidates groups
- `useCreateGroup / useUpdateGroup / useDeleteGroup` — group CRUD mutations
- `useActivities(eventProjectId)` — activities with signup counts
- `useActivitySignups(eventProjectId, activityId)` — per-activity signup list
- `useActivitySignup` — POST/DELETE mutation for staff-managed signups
- `useDietaryMedicalReport` — FERPA-gated report with 403-aware retry logic

**src/components/events/groups/ParticipantCard.tsx:**
Two variants: draggable (pool, @dnd-kit useDraggable) and static (assigned, with X button). Shows avatar (photo or initials gradient), name, grade badge with color-coded by grade level, red Shield icon for medical flags.

**src/components/events/groups/GroupCard.tsx:**
Droppable zone (@dnd-kit useDroppable) for each group:
- Header: name, leader, capacity bar (green/yellow/red by fill %)
- Inline edit form: name, capacity, description fields
- Delete confirm inline (not modal)
- Participants list with individual remove buttons
- Empty state with dashed border that highlights on drag-over

**src/components/events/groups/GroupDragBoard.tsx:**
Pool-to-groups DnD board:
- Two-column layout: left (1/3) unassigned pool, right (2/3) group cards grid
- Search + grade filter chips on the pool
- Auto-Assign button calls auto-assign API, shows count in toast
- Add Group inline form with name + capacity
- Uses MouseSensor + TouchSensor + KeyboardSensor (accessible)
- Static slot pattern: 20 fixed slots for useGroupAssignments calls (avoids hook-in-loop error)
- DragOverlay shows scaled/rotated copy of ParticipantCard during drag

**src/components/events/groups/ActivityManager.tsx:**
Activity management panel:
- List of activities with name, capacity bar, time, location
- Expandable rows show signed-up participants (fetched on expand)
- CRUD: create, update (inline form), delete (inline confirm)
- Remove participant from activity with staff note on full activities

**src/components/events/groups/DietaryMedicalReport.tsx:**
FERPA-gated aggregation view:
- Locked state when user lacks `events:medical:read` (admin/super-admin)
- 3 stat cards: dietary restrictions, allergy types, on medication
- Dietary table: need → count
- Allergy accordion: allergy → count + participant names (amber background)
- Medical notes grid: participant name cards (blue)
- Empty state when no data exists

### Task 2: PDF Generator, EventLogisticsTab, PortalView

**src/lib/event-pdf-utils.ts:**
Six jsPDF generator functions, all following the JsPDFConstructor pattern from label-utils.ts:
1. `generateBusManifest` — per-bus passenger table with medical flags column
2. `generateCabinRoster` — per-cabin roster with leader name and alternating row shading
3. `generateMedicalSummary` — FERPA-marked table with red-highlighted medication rows
4. `generateEmergencyContacts` — participant + emergency contact + relation + phone
5. `generateActivityRoster` — per-activity participant list with time/location header
6. `generateCheckInSheet` — numbered list with drawn checkbox column for manual use

All PDFs: consistent header (event name, date, section title, divider), 10pt table text, 12pt section headers, 16pt title, page numbers.

**src/components/events/groups/EventPDFGenerator.tsx:**
2x3 grid of format cards:
- Each card shows icon, name, description; FERPA badge on medical formats
- Click triggers dynamic jsPDF import + data fetch + PDF generation
- Loading spinner on the card during generation
- Medical formats locked (Lock icon) if user lacks medical permission
- Error display inline on card on failure

**src/components/events/EventLogisticsTab.tsx (full replacement):**
6 sub-tabs replacing the "Set up in Groups phase" placeholder:
- **Buses** — GroupDragBoard with BUS type
- **Cabins** — GroupDragBoard with CABIN type
- **Small Groups** — GroupDragBoard with SMALL_GROUP type
- **Activities** — ActivityManager
- **Dietary/Medical** — DietaryMedicalReport (FERPA-gated)
- **Print** — EventPDFGenerator
Quick stats header: total groups + assigned participants across all types.

**src/app/api/registration/[id]/groups/route.ts:**
Public GET endpoint (covered by existing `/api/registration/` middleware bypass):
- Validates registrationId exists
- Fetches EventGroupAssignment records with group.name, group.type, leader name
- Returns clean array of { groupId, groupName, groupType, leaderName, assignedAt }

**src/components/registration/PortalView.tsx:**
Added "Your Groups" section between Schedule and Documents:
- Fetches `/api/registration/[id]/groups` on mount with raw fetch (no TanStack Query in portal context)
- Shows skeleton during fetch
- Group cards: type badge (Bus/Cabin/Group icon), group name, leader name, description
- Empty state: "Groups haven't been assigned yet" with check-back message
- Only shown for REGISTERED status participants

## Commits

- `f08e74a` — feat(21-05): create TanStack Query hooks, drag-and-drop board, and activity manager
- `7daf33d` — feat(21-05): build PDF generator, replace EventLogisticsTab, update PortalView

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] title prop not valid on Lucide SVG icons**
- **Found during:** Task 1 (ParticipantCard)
- **Issue:** Lucide icons don't accept `title` prop — TypeScript TS2322 error
- **Fix:** Replaced `<Shield title="...">` with `<span aria-label="..."><Shield /></span>` for accessibility
- **Files modified:** src/components/events/groups/ParticipantCard.tsx
- **Commit:** Inline fix, included in Task 1 commit

**2. [Rule 1 - Bug] useGroupAssignments missing eventProjectId parameter**
- **Found during:** Task 1 — initial hook had `_` as placeholder for eventProjectId in URL
- **Issue:** URL `/api/events/projects/_/groups/${groupId}/assignments` was incorrect
- **Fix:** Added `eventProjectId` parameter to `useGroupAssignments` hook
- **Files modified:** src/lib/hooks/useEventGroups.ts
- **Commit:** Inline fix before Task 1 commit

**3. [Rule 1 - Bug] jsPDF typeof incompatibility with JsPDFConstructor**
- **Found during:** Task 2 TypeScript check
- **Issue:** `typeof jsPDF` from dynamic import doesn't match minimal `JsPDFConstructor` interface
- **Fix:** Cast dynamic import result to `any` at import site — consistent with label-utils pattern intent
- **Files modified:** src/components/events/groups/EventPDFGenerator.tsx
- **Commit:** Inline fix, included in Task 2 commit

### Design Decisions Made During Execution

- **Static slot pattern (not dynamic hooks):** `useGroupsWithAssignments` uses 20 fixed hook calls because React rules prohibit hooks in loops. This handles up to 20 groups per type — acceptable for camp/field trip use.
- **Portal uses raw fetch():** The portal page doesn't have a TanStack Query provider wrapping it, so `useQuery` can't be used in `GroupAssignmentsSection`. Raw `fetch()` with `useState` is the correct pattern here.

## Self-Check: PASSED

All artifacts verified:
- [x] src/lib/hooks/useEventGroups.ts — FOUND
- [x] src/components/events/groups/ParticipantCard.tsx — FOUND
- [x] src/components/events/groups/GroupCard.tsx — FOUND
- [x] src/components/events/groups/GroupDragBoard.tsx — FOUND
- [x] src/components/events/groups/ActivityManager.tsx — FOUND
- [x] src/components/events/groups/DietaryMedicalReport.tsx — FOUND
- [x] src/lib/event-pdf-utils.ts — FOUND (6 generator functions)
- [x] src/components/events/groups/EventPDFGenerator.tsx — FOUND
- [x] src/components/events/EventLogisticsTab.tsx — no placeholder text found
- [x] src/app/api/registration/[id]/groups/route.ts — FOUND
- [x] src/components/registration/PortalView.tsx — "Your Groups" section present
- [x] Commit f08e74a — FOUND
- [x] Commit 7daf33d — FOUND
- [x] `npx tsc --noEmit` — 0 errors
