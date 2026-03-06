---
phase: 02-core-tickets
plan: 02
subsystem: ui
tags: [maintenance, wizard, photo-upload, supabase-storage, ai-suggestions, tanstack-query, framer-motion, react]

# Dependency graph
requires:
  - phase: 02-core-tickets
    plan: 01
    provides: "All ticket API routes including upload-url, ai-suggest-category, ai-detect-multi-issue, POST /maintenance/tickets"
  - phase: 01-foundation
    provides: "Auth, org-scoped Prisma, animation system, glassmorphism CSS utilities, useCampusLocations hook"
provides:
  - 4-step ticket submission wizard (Location → Photos → Details → Review) with animated transitions
  - Signed URL photo upload to Supabase (bypasses Next.js 1MB body limit) with per-photo progress
  - AI category suggestion from first photo upload (fire-and-forget, graceful degrade)
  - AI multi-issue detection on review step with split-into-2-tickets flow
  - Extended useCampusLocations hook with room-level entries and Building > Area > Room hierarchy
  - My Requests card grid: responsive 1/2/3 column layout, TanStack Query fetch, StaggerList animation
  - TicketCard with status/priority/category color badges, relative timestamps, location breadcrumbs
  - MyRequestsView with wizard/grid view switch via AnimatePresence
affects: [03-kanban-ui, 06-compliance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signed URL upload pattern: POST /upload-url → PUT file directly to Supabase storage URL — avoids Next.js body size limits"
    - "Fire-and-forget AI: fetch AI endpoints without await after photo upload; store result in state; gracefully no-op on failure"
    - "Multi-step wizard with direction-aware AnimatePresence: track 'forward'/'backward' direction, pass as custom to variants"
    - "useDeferredValue for search filtering: no debounce boilerplate, React 18 concurrent filtering"
    - "StaggerList + StaggerItem pattern: wraps grid to provide staggered card entrance on mount"

key-files:
  created:
    - src/components/maintenance/SubmitRequestWizard.tsx
    - src/components/maintenance/SubmitRequestWizard/StepLocation.tsx
    - src/components/maintenance/SubmitRequestWizard/StepPhotos.tsx
    - src/components/maintenance/SubmitRequestWizard/StepDetails.tsx
    - src/components/maintenance/SubmitRequestWizard/StepReview.tsx
    - src/components/maintenance/TicketCard.tsx
    - src/components/maintenance/MyRequestsGrid.tsx
  modified:
    - src/lib/hooks/useCampusLocations.ts (added room-level entries and hierarchy)
    - src/components/maintenance/MyRequestsView.tsx (replaced placeholder with wizard + grid)

key-decisions:
  - "Room-level entries in useCampusLocations use roomId field with type 'room' and hierarchy array for Building > Area > Room display"
  - "Wizard rendered inline as full-area panel (not modal) for mobile usability — avoids scroll lock issues on mobile"
  - "AI suggested category auto-applies on first photo upload (pre-fills Details step), user can freely override"
  - "Split-into-2-tickets: submits first ticket, then resets wizard to step 2 (Details) with same location and AI-suggested title/category for second"

patterns-established:
  - "Wizard step validation: array of booleans indexed by step number — `stepValid[currentStep]` drives Next button disabled state"
  - "Photo upload lifecycle: upload-url API → PUT to signed URL → store publicUrl in wizard state → fire AI suggestion for first photo"
  - "TicketCard receives full ticket shape from listTickets API (includes assignedTo, building, area, room selects)"

requirements-completed:
  - SUBMIT-01
  - SUBMIT-02
  - SUBMIT-03
  - SUBMIT-04
  - SUBMIT-05
  - SUBMIT-06
  - SUBMIT-08
  - SUBMIT-09

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 2 Plan 2: Ticket Submission Wizard Summary

**Mobile-first 4-step submission wizard (Location → Photos → Details → Review) with signed URL photo upload, background AI category/multi-issue detection, and a responsive My Requests card grid replacing the Phase 1 placeholder**

## Performance

- **Duration:** 6 minutes
- **Started:** 2026-03-06T02:46:45Z
- **Completed:** 2026-03-06T02:52:45Z
- **Tasks:** 2 (plus 1 human-verify checkpoint)
- **Files modified/created:** 8

## Accomplishments

- Complete teacher-facing submission wizard with Framer Motion slide transitions and direction awareness — forward/backward navigation feels native
- Signed URL photo upload bypasses Next.js 1MB body limit; each photo has its own upload state (uploading spinner, success checkmark, error state); AI category suggestion fires after first photo upload without blocking the user
- My Requests card grid with responsive 1/2/3 column layout, StaggerList entrance animations, TicketCard with status/priority/category color-coded badges, relative timestamps, and location breadcrumbs

## Task Commits

Each task was committed atomically:

1. **Task 1: Submission wizard with photo upload and AI features** - `08275e3` (feat)
2. **Task 2: My Requests card grid and wiring into MyRequestsView** - `c2b863d` (feat)

**Plan metadata:** `46a66ba` (docs: complete submission wizard and My Requests grid plan)

## Files Created/Modified

**Created:**
- `src/components/maintenance/SubmitRequestWizard.tsx` - 4-step orchestrator with progress bar, direction-aware AnimatePresence, success state, split-ticket flow
- `src/components/maintenance/SubmitRequestWizard/StepLocation.tsx` - Search autocomplete with useDeferredValue, grouped results, hierarchy chips, clear/re-select
- `src/components/maintenance/SubmitRequestWizard/StepPhotos.tsx` - Multi-photo upload via signed URL, drag-and-drop, 5-photo limit, AI category background call
- `src/components/maintenance/SubmitRequestWizard/StepDetails.tsx` - Title/category/priority/description/availability/schedule fields with AI suggested chip and toggle
- `src/components/maintenance/SubmitRequestWizard/StepReview.tsx` - Full summary card, AI multi-issue detection banner, split-into-2 flow, submit button
- `src/components/maintenance/TicketCard.tsx` - Compact card with color-coded badges, ticket number, relative timestamp, location, assigned tech avatar
- `src/components/maintenance/MyRequestsGrid.tsx` - TanStack Query fetch, 1/2/3 column grid, StaggerList, empty state with CTA

**Modified:**
- `src/lib/hooks/useCampusLocations.ts` - Added room-level entries (roomId, type: 'room'), hierarchy array, rooms from areas and direct-under-building
- `src/components/maintenance/MyRequestsView.tsx` - Replaced placeholder with wizard/grid switch, AnimatePresence transitions, header with cancel/back navigation

## Decisions Made

- Wizard renders inline as full-area panel (not a modal overlay) — avoids scroll lock and z-index issues on mobile; provides full vertical space for content
- AI suggested category auto-applies immediately (pre-selects the dropdown on Details step), user can freely change — reduces friction without being prescriptive
- Split-into-2 flow: submit first ticket, then reset wizard to Details step (step 2) with same location and AI-suggested title/category for second ticket — location re-selection feels redundant for split cases
- useDeferredValue instead of manual debounce — React 18 concurrent feature, zero boilerplate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — photo upload requires the Supabase `maintenance-photos` bucket documented in the Phase 2 Plan 1 summary.

## Next Phase Readiness

- Wizard and My Requests grid are complete; ready for human verification at the checkpoint
- Phase 3 (Kanban UI) can build directly on the same ticket data shape returned by `GET /api/maintenance/tickets`
- TicketCard shape is compatible with what the Kanban board will need

## Self-Check: PASSED

All files found and all commits verified.

- Files: 9/9 FOUND (7 created, 2 modified)
- Commits: 3/3 FOUND (08275e3, c2b863d, 46a66ba)
- Checkpoint: human-verify Task 3 approved by user on 2026-03-06

---
*Phase: 02-core-tickets*
*Completed: 2026-03-06*
