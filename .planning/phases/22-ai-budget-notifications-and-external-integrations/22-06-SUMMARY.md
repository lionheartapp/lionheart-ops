---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 06
subsystem: ui
tags: [react, gemini, ai, events, chat, wizard, next.js]

# Dependency graph
requires:
  - phase: 22-ai-budget-notifications-and-external-integrations
    provides: Plan 03 — generateEventFromDescription AI service, /api/events/ai/create-from-description route, AIEventSuggestion type, schedule/tasks/budget API endpoints

provides:
  - AIEventChat: chat-style interface with message bubbles, typing indicator, first-generation + refinement flow
  - AIEventPreview: 5-section editable preview (details, schedule, docs, tasks, budget) with local state management
  - AIEventWizard: two-panel orchestrator (chat 40%, preview 60%), mobile toggle, EventProject creation with schedule blocks and tasks
  - /events/new/ai page: minimal page component, auth enforced by middleware
  - Sidebar "Create with AI" link in Events nav with Sparkles icon and aurora dot indicator

affects:
  - Phase 22 Plans 07-08 (generate-then-edit features and template UI — both extend the AI event creation surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI chat pattern: first message triggers create-from-description; follow-ups use same endpoint with accumulated context and call onSuggestionGenerated to refresh preview"
    - "Two-panel wizard: chat (40%) + preview (60%) with mobile stacked toggle"
    - "AI block type mapping: BREAK→FREE_TIME, CEREMONY→SESSION to normalize AI output to API enum"
    - "Budget initialization: GET /budget triggers idempotent initializeCategories; line item creation deferred to budget tab"

key-files:
  created:
    - src/components/events/ai/AIEventChat.tsx
    - src/components/events/ai/AIEventPreview.tsx
    - src/components/events/ai/AIEventWizard.tsx
    - src/app/events/new/ai/page.tsx
  modified:
    - src/components/Sidebar.tsx (Sparkles import + Create with AI nav link)

key-decisions:
  - "AI wizard page does not use DashboardLayout — consistent with events/page.tsx and events/[id]/page.tsx patterns"
  - "Budget API only supports line items (not custom category creation from client) — wizard triggers GET /budget for idempotent preset initialization, defers AI budget categories to user"
  - "Schedule block type enum mapping applied in wizard (BREAK→FREE_TIME, CEREMONY→SESSION) to handle AI output vs API constraints"
  - "Promise.allSettled used for schedule block and task creation — partial success is acceptable; event project already created"
  - "Create with AI sidebar link shown to all authenticated users — API enforces EVENT_PROJECT_CREATE permission"

patterns-established:
  - "AIEventChat pattern: sends full description to /api/events/ai/create-from-description on every message (first + refinements); onSuggestionGenerated fires each time to sync preview"
  - "AIEventPreview local state: syncs from suggestion prop via useEffect on change; all edits are local until Create Event clicked"

requirements-completed:
  - AI-01
  - AI-05

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 22 Plan 06: AI Event Creation Wizard Summary

**Chat-style AI event creation wizard with two-panel layout — staff describe events in natural language and AI fills all fields (title, dates, schedule, tasks, docs, budget) for review and editing before creation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T02:07:07Z
- **Completed:** 2026-03-16T02:14:00Z
- **Tasks:** 2
- **Files modified:** 4 created, 1 modified

## Accomplishments
- AIEventChat component with message bubbles (user right-aligned dark, assistant left-aligned glass), typing indicator (3 bouncing dots), first generation + conversational refinement flow, error handling for AI_UNAVAILABLE
- AIEventPreview with 5 fully editable sections: Event Details (title, description, dates, location, attendance), Suggested Schedule (table with day/time/title/type, row-level edit + delete + add), Suggested Documents (checkboxes + add), Suggested Tasks (checkboxes + inline edit + priority selector + add), Budget Estimate (category/min/max table with totals + add/remove)
- AIEventWizard two-panel orchestrator: creates EventProject, then schedule blocks via Promise.allSettled, then tasks, then triggers budget initialization; navigates to /events/{id}?tab=overview on success
- Sidebar updated with "Create with AI" link (Sparkles icon, aurora gradient dot indicator) in Events nav section

## Task Commits

Each task was committed atomically:

1. **Task 1: AI chat and preview components** - `3f6fadd` (feat)
2. **Task 2: AI wizard page, orchestration, and sidebar link** - `9366690` (feat)

## Files Created/Modified
- `src/components/events/ai/AIEventChat.tsx` - Chat interface with message bubbles, typing indicator, API call on submit, refinement support
- `src/components/events/ai/AIEventPreview.tsx` - 5-section editable preview with local state management and aurora gradient Create Event button
- `src/components/events/ai/AIEventWizard.tsx` - Two-panel orchestrator: state management, creation flow, block type normalization, mobile toggle
- `src/app/events/new/ai/page.tsx` - Minimal page wrapper, auth by middleware, permission check by API
- `src/components/Sidebar.tsx` - Added Sparkles import and Create with AI nav link with aurora dot indicator

## Decisions Made
- AI wizard page matches the events/page.tsx pattern (no DashboardLayout wrapper) — layout is implicit from app structure
- Budget creation from AI data deferred to the budget tab (no client-side endpoint to create custom budget categories) — GET /budget triggers idempotent preset initialization which is sufficient for event creation
- Schedule block types from AI are mapped to API enum values (BREAK→FREE_TIME, CEREMONY→SESSION) via a normalize map in the wizard
- Promise.allSettled used for schedule and task creation — ensures EventProject is always created even if individual child records fail
- Create with AI sidebar link shown to all authenticated users (no client-side permission guard needed since the API enforces EVENT_PROJECT_CREATE)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Schedule block type normalization**
- **Found during:** Task 2 (AIEventWizard.tsx)
- **Issue:** AI generates block types (BREAK, CEREMONY) that are not in the CreateScheduleBlockSchema enum — API would reject them with a 400 validation error
- **Fix:** Added BLOCK_TYPE_MAP in AIEventWizard to normalize AI block types to valid API enum values before POST
- **Files modified:** src/components/events/ai/AIEventWizard.tsx
- **Verification:** TypeScript compilation passes; all AI block types have a mapping
- **Committed in:** 9366690 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — input normalization)
**Impact on plan:** Required for correct operation — without normalization, schedule block creation would fail silently for common block types like BREAK. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `__tests__/lib/assistant-prompt.test.ts` and `src/components/events/EventBudgetTab.tsx` — both unrelated to this plan, not fixed (out of scope per deviation rule)

## User Setup Required
None — no external service configuration required beyond GEMINI_API_KEY already documented.

## Next Phase Readiness
- AI event creation wizard complete — ready for Phase 22 Plans 07-08 (generate-then-edit UI, template system)
- /events/new/ai page live at route level; sidebar link surfaced for all authenticated users
- Wizard creates full EventProject with schedule blocks and tasks from AI suggestion

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: src/components/events/ai/AIEventChat.tsx
- FOUND: src/components/events/ai/AIEventPreview.tsx
- FOUND: src/components/events/ai/AIEventWizard.tsx
- FOUND: src/app/events/new/ai/page.tsx
- FOUND commit 3f6fadd: feat(22-06): add AI event chat and preview components
- FOUND commit 9366690: feat(22-06): add AI event wizard page and sidebar link
