---
phase: 22-ai-budget-notifications-and-external-integrations
plan: "07"
subsystem: events-ai
tags: [ai, events, registration, logistics, budget, overview, gemini]
dependency_graph:
  requires: ["22-01", "22-03"]
  provides: ["ai-form-generation", "ai-group-assignments", "conflict-detection", "budget-estimation", "feedback-analysis"]
  affects: ["events", "registration", "budget", "logistics"]
tech_stack:
  added: []
  patterns:
    - "generate-then-edit AI pattern — AI generates starting point, staff always edits"
    - "two-phase fetch — immediate metrics first, AI summary as second call"
    - "deterministic conflict detection — no AI, pure DB queries + logic"
    - "historical budget estimation — 3+ past events → historical average, AI fallback otherwise"
key_files:
  created:
    - src/app/api/events/ai/generate-form/route.ts
    - src/app/api/events/ai/generate-groups/route.ts
    - src/app/api/events/ai/detect-conflicts/route.ts
    - src/app/api/events/ai/estimate-budget/route.ts
    - src/app/api/events/ai/analyze-feedback/route.ts
  modified:
    - src/lib/services/ai/eventAIService.ts
    - src/lib/types/event-ai.ts
    - src/components/events/project/RegistrationTab.tsx
    - src/components/events/EventLogisticsTab.tsx
    - src/components/events/EventOverviewTab.tsx
    - src/components/events/budget/BudgetLineItemTable.tsx
decisions:
  - "detectConflicts is deterministic (rawPrisma, no AI) — checks room/staff/transportation/audience overlaps"
  - "estimateBudgetFromHistory requires 3+ completed events with budget data — AI fallback otherwise"
  - "AIStatusSection auto-fetches on mount (two-phase pattern established in Phase 22-03)"
  - "FeedbackAnalysisSection is on-demand (Run Analysis button) — only auto for completed events"
  - "RegistrationTab AI modal creates form first if none exists, then opens modal"
  - "BudgetLineItemTable accepts optional eventProjectId + onApplyEstimates props for backward compat"
metrics:
  duration_minutes: 13
  tasks_completed: 2
  files_created: 5
  files_modified: 6
  completed_date: "2026-03-16"
---

# Phase 22 Plan 07: AI Generate-Then-Edit Features Summary

**One-liner:** AI form generation, group assignments, conflict detection, budget estimation, status summaries, and feedback analysis wired into 4 event tabs via the generate-then-edit pattern.

## What Was Built

### Task 1: AI Service Extensions and 5 New API Routes

**Extended `eventAIService.ts`** with 4 new functions plus type extensions:

- **`generateRegistrationForm()`** — Prompts Gemini to suggest event-appropriate form sections and fields based on event type (camp vs field trip vs retreat etc.). Returns `AIGeneratedForm` with sections and fields. Returns null without API key.

- **`generateGroupAssignments()`** — Takes participants, groups, and constraints (balance gender/grade, honor friend requests). Prompts Gemini to assign all participants optimally. Returns `AIGroupAssignmentResult` with assignments and warnings.

- **`detectConflicts()`** — Deterministic, no AI. Uses `rawPrisma` to query all overlapping EventProjects in the org. Checks 5 conflict types: room double-booking, building overlap, staff scheduling, transportation overlap (off-campus same day), audience overlap (same school). Returns `AIConflictReport` with severity-coded conflicts.

- **`estimateBudgetFromHistory()`** — Queries past completed events with budget data. If 3+ events found: calculates per-category averages scaled for attendance, returns with `isHistorical: true`. Falls back to Gemini `estimateBudget()` otherwise.

- **`analyzeFeedback()`** — Already existed; ensured types are complete with `AIFeedbackAnalysis`.

**New types in `event-ai.ts`:** `AIGeneratedForm`, `AIFormSection`, `AIFormField`, `AIGroupParticipant`, `AIGroupTarget`, `AIGroupConstraints`, `AIGroupAssignment`, `AIGroupAssignmentResult`, `AIConflict`, `AIConflictReport`, `AIHistoricalBudgetEstimate`.

**5 new API routes** (all follow standard auth/permission/org-context pattern):
- `POST /api/events/ai/generate-form` — EVENTS_REGISTRATION_MANAGE permission
- `POST /api/events/ai/generate-groups` — EVENTS_GROUPS_MANAGE permission
- `POST /api/events/ai/detect-conflicts` — EVENT_PROJECT_CREATE permission
- `POST /api/events/ai/estimate-budget` — EVENTS_BUDGET_READ permission
- `POST /api/events/ai/analyze-feedback` — EVENTS_SURVEYS_MANAGE permission

### Task 2: AI Integration Buttons in 4 Tabs

**RegistrationTab.tsx:**
- Added "Generate with AI" button in empty state and in form sub-tab header
- Modal asks for event type (pre-filled) and special requirements
- On success: converts AI sections to `FormSection[]` shape, saves via `useUpdateRegistrationForm`, shows success toast with section count
- Creates form first if none exists, then opens modal

**EventLogisticsTab.tsx:**
- "AI Suggest Assignments" button (sparkle icon) in header — visible on bus/cabin/small-groups tabs
- Shows preview modal with group assignments grouped by group ID, warnings in amber alert
- "Check Conflicts" button (triangle icon) — calls detect-conflicts, shows inline alert panel
- Severity-coded alerts: high (red), medium (amber), low (blue)
- Green checkmark when no conflicts found

**EventOverviewTab.tsx:**
- AI Status Summary section with completion progress bar (aurora gradient)
- Auto-fetches on mount with loading skeleton, Refresh button, graceful error
- At-risk items as amber badges, next steps as numbered list
- Post-Event Feedback Analysis section — on-demand (completed events only)
- Theme cards with sentiment badges (positive/negative/neutral/mixed)
- Numbered action items checklist

**BudgetLineItemTable.tsx:**
- AI Estimate button with `eventProjectId` prop (added to component interface)
- Floating comparison panel shows AI-suggested ranges per category
- "Based on N past events" badge for historical data, "AI Generated" for fallback
- Checkmark for already-budgeted categories, sparkle for suggested
- "Apply N estimates" applies midpoint of estimated ranges to unfilled categories

## Deviations from Plan

None — plan executed exactly as written.

All pre-existing TypeScript errors (in `IntegrationsTab.tsx`, `BudgetExpenseDrawer.tsx`, `BudgetRevenueSection.tsx`, `planningCenterService.ts`, `assistant-prompt.test.ts`) are out-of-scope pre-existing issues not caused by this plan's changes.

## Architecture Notes

- `detectConflicts()` imports `rawPrisma` at the module level (top of eventAIService.ts) — cross-org queries bypass org context by design
- `generateGroupAssignments` limits participant list to 50 for Gemini context window efficiency
- `analyzeFeedback` route only passes TEXT/DROPDOWN field responses (excludes signatures, files)
- All AI routes return `503 AI_UNAVAILABLE` when GEMINI_API_KEY is absent — UI shows degraded-gracefully states

## Self-Check: PASSED

Created files verified:
- src/app/api/events/ai/generate-form/route.ts: FOUND
- src/app/api/events/ai/generate-groups/route.ts: FOUND
- src/app/api/events/ai/detect-conflicts/route.ts: FOUND
- src/app/api/events/ai/estimate-budget/route.ts: FOUND
- src/app/api/events/ai/analyze-feedback/route.ts: FOUND

Commits verified:
- bdc3f5d: feat(22-07): AI service extensions and 5 new API routes
- 019c31f: feat(22-07): AI integration buttons in Registration, Logistics, Overview, and Budget tabs
