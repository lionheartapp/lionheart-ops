# Phase 19 — Deferred Items

Items discovered during plan execution that are out-of-scope for the current plan.
These are pre-existing issues not caused by current task changes.

## Pre-existing TypeScript Errors

### 1. EventProjectTabs.tsx — Missing tab file imports

**Found during:** Plan 06, Task 2 (TypeScript check)
**File:** `src/components/events/EventProjectTabs.tsx`
**Errors:**
- Cannot find module './EventPeopleTab'
- Cannot find module './EventDocumentsTab'
- Cannot find module './EventLogisticsTab'
- Cannot find module './EventBudgetTab'
- Cannot find module './EventCommsTab'
**Root cause:** These tab components are planned for future plans (Plan 05 deferred them). EventProjectTabs.tsx was created with forward references.
**Resolution:** Implement the missing tab stubs or remove the imports until implemented.

### 2. EventTasksTab.tsx — Missing `status` field in CreateEventTaskInput

**Found during:** Plan 06, Task 2 (TypeScript check)
**File:** `src/components/events/EventTasksTab.tsx` (line 452)
**Error:** Property 'status' is missing in type
**Root cause:** Pre-existing since Plan 05 implementation.
**Resolution:** Add `status: 'TODO'` default to the CreateEventTaskInput payload in EventTasksTab.

### 3. assistant-prompt.test.ts — Missing `importance` field in test fixture

**Found during:** Plan 06, Task 2 (TypeScript check)
**File:** `__tests__/lib/assistant-prompt.test.ts` (line 158)
**Error:** `importance` property missing from `relevantFacts` test fixture
**Root cause:** Pre-existing issue from a schema change in contextAssemblyService.
**Resolution:** Update test fixture to include `importance: 0` (or appropriate value).
