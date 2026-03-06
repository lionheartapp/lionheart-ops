---
phase: 02-core-tickets
plan: 04
subsystem: ui
tags: [react, tanstack-query, framer-motion, tailwindcss, glassmorphism, ticket-detail, status-machine]

# Dependency graph
requires:
  - phase: 02-core-tickets/02-01
    provides: Maintenance ticket API (GET /id, PATCH /status, POST /activities, upload-url)
  - phase: 02-core-tickets/02-02
    provides: Submission wizard patterns, signed URL upload, usePermissions hook
  - phase: 02-core-tickets/02-03
    provides: Work Orders table patterns, claim mutation, permission checks

provides:
  - Full-page ticket detail view at /maintenance/tickets/[id]
  - TicketStatusTracker with primary linear path + branch state indicators
  - TicketActivityFeed with timeline, comment box, internal note toggle
  - HoldReasonInlineForm inline expansion (not modal) for ON_HOLD gate
  - QACompletionModal requiring photo + completion note for QA transition
  - QAReviewPanel for Head sign-off on QA tickets with Approve/Send Back
  - canApproveQA permission field on /api/auth/permissions

affects: [03-kanban, 04-labor-costs, 05-ai-diagnostics, 06-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-column ticket detail layout (lg:grid-cols-5, left 2 cols, right 3 cols)
    - Status machine branch state indicators (ON_HOLD/SCHEDULED/CANCELLED as badges, not linear steps)
    - Timeline activity feed with colored icon types (STATUS_CHANGE/COMMENT/ASSIGNMENT/INTERNAL_NOTE)
    - Inline form expansion with Framer Motion expandCollapse for hold gate
    - Modal gate pattern with required fields enforced client-side before submit enables
    - QA review panel: photo gallery + labor/cost summary + approve/send-back with required note
    - canApproveQA permission extended on /api/auth/permissions route

key-files:
  created:
    - src/app/maintenance/tickets/[id]/page.tsx
    - src/components/maintenance/TicketDetailPage.tsx
    - src/components/maintenance/TicketStatusTracker.tsx
    - src/components/maintenance/TicketActivityFeed.tsx
    - src/components/maintenance/HoldReasonInlineForm.tsx
    - src/components/maintenance/QACompletionModal.tsx
    - src/components/maintenance/QAReviewPanel.tsx
  modified:
    - src/app/api/auth/permissions/route.ts
    - src/lib/hooks/usePermissions.ts
    - src/lib/queries.ts

key-decisions:
  - "TicketStatusTracker uses primary linear path (BACKLOG->TODO->IN_PROGRESS->QA->DONE) with ON_HOLD/SCHEDULED/CANCELLED rendered as branch state badges above relevant step — not as sequential steps in the tracker"
  - "ON_HOLD gate uses inline form expansion (not modal) per CONTEXT.md decision — HoldReasonInlineForm expands below action button with Framer Motion"
  - "QA gate enforces photo + completion note at UI level (submit disabled until both provided) in addition to server enforcement"
  - "QAReviewPanel only renders when ticket.status === QA AND user has canApproveQA — UI gate enforcing LIFE-05"
  - "Send Back rejection note required before confirm button enables — inline textarea within QAReviewPanel"
  - "Internal comment checkbox visible only when isPrivileged=true (MAINTENANCE_READ_ALL or MAINTENANCE_CLAIM) — API handles final filtering"
  - "canApproveQA (maintenance:approve:qa) added to /api/auth/permissions response and usePermissions hook"

patterns-established:
  - "Gate UI pattern: inline expansion for hold (no modal), modal for QA transition, panel for sign-off"
  - "Activity timeline: colored left-border icon + actor initials avatar + relative timestamp + content"
  - "Branch state indicator: amber/purple/red badge above relevant status step, not a sequential tracker node"
  - "Required-field gate: submit/confirm button disabled until all required fields are filled"
  - "Two-column detail layout: lg:grid-cols-5 with col-span-2 (info) and col-span-3 (actions/feed)"

requirements-completed: [DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, LIFE-08]

# Metrics
duration: ~25min (human verify included)
completed: 2026-03-06
---

# Phase 2 Plan 04: Ticket Detail Page Summary

**Full two-column ticket detail page with 7 gate-enforcing UI components: status tracker (primary path + branch indicators), activity feed with internal comments, inline hold form, QA modal, and Head sign-off panel**

## Performance

- **Duration:** ~25 min (includes human verification checkpoint)
- **Started:** 2026-03-05T19:07:00Z
- **Completed:** 2026-03-06T03:09:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 10

## Accomplishments

- Built complete ticket detail page at `/maintenance/tickets/[id]` with two-column glassmorphism layout stacking on mobile
- Implemented 5 specialized UI components enforcing all 8-status state machine gate requirements at the UI layer
- Added `canApproveQA` permission to the permissions endpoint and `usePermissions` hook to support role-gated QA sign-off

## Task Commits

Each task was committed atomically:

1. **Task 1: Ticket detail page with status tracker, activity feed, and gate UIs** - `caa34bf` (feat)
2. **Task 2: Verify ticket detail page end-to-end** - checkpoint:human-verify (approved by user)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified

- `src/app/maintenance/tickets/[id]/page.tsx` - Next.js page route with auth guard + DashboardLayout
- `src/components/maintenance/TicketDetailPage.tsx` - Two-column layout orchestrator (792 lines) with TanStack Query, all left/right sections, action buttons, contextual gate UIs
- `src/components/maintenance/TicketStatusTracker.tsx` - Status tracker with primary linear path (BACKLOG->TODO->IN_PROGRESS->QA->DONE) and branch state indicators for ON_HOLD/SCHEDULED/CANCELLED
- `src/components/maintenance/TicketActivityFeed.tsx` - Chronological timeline with STATUS_CHANGE/COMMENT/ASSIGNMENT/INTERNAL_NOTE entries, comment box, internal note checkbox
- `src/components/maintenance/HoldReasonInlineForm.tsx` - Inline expansion for ON_HOLD with required hold reason dropdown + optional note, Framer Motion animation
- `src/components/maintenance/QACompletionModal.tsx` - Modal gate requiring completion photo (signed URL upload) + completion note (min 10 chars), submit disabled until both provided
- `src/components/maintenance/QAReviewPanel.tsx` - Head sign-off panel with photo gallery, labor/cost summary, Approve & Close + Send Back with required rejection note
- `src/app/api/auth/permissions/route.ts` - Extended with `canApproveQA` field (maintenance:approve:qa)
- `src/lib/hooks/usePermissions.ts` - Added `canApproveQA` to hook return type
- `src/lib/queries.ts` - Added `canApproveQA` to permissions type

## Decisions Made

- TicketStatusTracker renders ON_HOLD, SCHEDULED, and CANCELLED as branch state badges above the relevant step (e.g., amber "On Hold" badge above IN_PROGRESS), NOT as sequential nodes in the 5-step primary path — this accurately reflects the state machine topology
- HoldReasonInlineForm expands inline below the "On Hold" button using Framer Motion expandCollapse, per CONTEXT.md decision (not a modal)
- QAReviewPanel is conditionally rendered only when `ticket.status === 'QA' && isHead` — the UI gate for LIFE-05
- Send Back requires non-empty rejection note before the confirm button enables — enforced in QAReviewPanel
- `canApproveQA` added to the permissions endpoint rather than creating a separate endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 (Core Tickets) is now fully complete: API engine (02-01), submission wizard (02-02), work orders table (02-03), and ticket detail with all gate UIs (02-04)
- Phase 3 (Kanban) can begin — the Kanban board will layer on top of the ticket engine; it needs the status transition API and activity feed patterns established here
- Phase 5 (AI Diagnostics) will use the ticket detail page to surface AI recommendations — the QAReviewPanel's labor/cost section is already designed for Phase 4's data

## Self-Check: PASSED

- FOUND: src/app/maintenance/tickets/[id]/page.tsx
- FOUND: src/components/maintenance/TicketDetailPage.tsx
- FOUND: src/components/maintenance/TicketStatusTracker.tsx
- FOUND: src/components/maintenance/TicketActivityFeed.tsx
- FOUND: src/components/maintenance/HoldReasonInlineForm.tsx
- FOUND: src/components/maintenance/QACompletionModal.tsx
- FOUND: src/components/maintenance/QAReviewPanel.tsx
- FOUND: commit caa34bf

---
*Phase: 02-core-tickets*
*Completed: 2026-03-06*
