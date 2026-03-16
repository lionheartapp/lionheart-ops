---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 08
subsystem: ui
tags: [react, tanstack-query, framer-motion, event-templates, ai, gemini]

# Dependency graph
requires:
  - phase: 22-ai-budget-notifications-and-external-integrations
    provides: Plan 03 — EventTemplate model, eventTemplateService, AI event service (enhanceTemplateForReuse), template API routes

provides:
  - useEventTemplates.ts: useTemplates, useTemplate, useTemplateMutations hooks with optimistic delete
  - SaveAsTemplateDialog: quick-action modal to capture event structure as reusable template
  - TemplateListDrawer: searchable/filterable template browser with delete confirmation
  - CreateFromTemplateWizard: 3-step modal (details → AI enhancement → confirm) that creates EventProject and navigates to it
  - /api/events/ai/enhance-template: POST route wiring enhanceTemplateForReuse for client-side AI calls
  - EventOverviewTab: Save as Template button (visible for CONFIRMED/IN_PROGRESS/COMPLETED events)

affects:
  - Phase 22 Plan 10 (events list page — can wire TemplateListDrawer + CreateFromTemplateWizard for "New from Template" flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-step wizard pattern: details → AI async enhancement → confirm with back/next navigation"
    - "AI-optional enhancement: if API call fails, wizard continues with raw template data, no error shown to user"
    - "Optimistic delete pattern for templates: setQueriesData removes item from all cached lists, reverts on error"
    - "Template eligibility guard: only CONFIRMED/IN_PROGRESS/COMPLETED events show Save as Template button"

key-files:
  created:
    - src/lib/hooks/useEventTemplates.ts
    - src/components/events/templates/SaveAsTemplateDialog.tsx
    - src/components/events/templates/TemplateListDrawer.tsx
    - src/components/events/templates/CreateFromTemplateWizard.tsx
    - src/app/api/events/ai/enhance-template/route.ts
  modified:
    - src/components/events/EventOverviewTab.tsx

key-decisions:
  - "enhance-template API route needed — no existing route for client-side AI template enhancement; added as /api/events/ai/enhance-template (Rule 2 auto-add)"
  - "AI enhancement failure is non-fatal in wizard — catch silently, set enhancements to null, wizard skips to step 3 with raw template data"
  - "Template eligibility: DRAFT events excluded from Save as Template (incomplete events make poor templates)"
  - "EventProjectTabs unchanged — no creation menu exists in tabs; From Template path deferred to events list page (Plan 10)"

patterns-established:
  - "Template wizard: async AI call in step transition (not on mount) so step 2 renders skeleton then populates"
  - "TemplateListDrawer uses client-side name/description search on top of server-side eventType filter"
  - "Save as Template dialog: what-gets-captured checklist is purely informational (read-only checkmarks)"

requirements-completed:
  - AI-10
  - AI-11

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 22 Plan 08: Template UI — Save, Browse, Create Summary

**3-step create-from-template wizard with AI date adjustment, searchable template drawer, and Save as Template button on event Overview tab**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T02:06:49Z
- **Completed:** 2026-03-16T02:12:49Z
- **Tasks:** 2
- **Files modified:** 5 created, 1 modified

## Accomplishments
- TanStack Query hooks for all template operations (list, detail, save, create, delete with optimistic removal)
- SaveAsTemplateDialog with name/type/description fields and informational what-gets-captured checklist
- TemplateListDrawer with real-time search, event type filter, usage metadata, and delete confirmation
- CreateFromTemplateWizard: step 1 (event details), step 2 (AI enhancement via enhance-template API), step 3 (confirm + create); navigates to new event on success
- AI enhance-template API route bridging client wizard to Gemini enhanceTemplateForReuse service
- EventOverviewTab gains Save as Template button (secondary ghost pill style) for eligible event statuses

## Task Commits

Each task was committed atomically:

1. **Task 1: Template hooks, save dialog, and list drawer** - `a502a86` (feat)
2. **Task 2: Create-from-template wizard, AI enhance route, overview integration** - `d754e44` (feat)

## Files Created/Modified
- `src/lib/hooks/useEventTemplates.ts` — useTemplates (with type filter), useTemplate (by ID), useTemplateMutations (saveAsTemplate, createFromTemplate, deleteTemplate with optimistic removal)
- `src/components/events/templates/SaveAsTemplateDialog.tsx` — Modal dialog: name, event type dropdown, optional description, what's captured checklist, success toast
- `src/components/events/templates/TemplateListDrawer.tsx` — Right-side drawer: search input, type filter select, staggered template cards with Use/Delete, empty state
- `src/components/events/templates/CreateFromTemplateWizard.tsx` — 3-step wizard with step indicator, AnimatePresence crossfade, async AI loading in step 2, router.push to new event
- `src/app/api/events/ai/enhance-template/route.ts` — POST route: validates body, calls enhanceTemplateForReuse, returns enhanced TemplateData
- `src/components/events/EventOverviewTab.tsx` — Added BookmarkPlus import, saveTemplateOpen state, TEMPLATE_ELIGIBLE_STATUSES guard, Save as Template button and SaveAsTemplateDialog

## Decisions Made
- The enhance-template API route was not in Plan 03's 5 routes but was required for the wizard — auto-added (Rule 2, missing critical functionality)
- AI failure in wizard step 2 is silently swallowed; enhancements set to null and step 2 shows "AI not available" message rather than an error toast — keeps the wizard flow smooth
- Template eligibility restricts to CONFIRMED/IN_PROGRESS/COMPLETED so planners can't templatize half-baked events
- TemplateListDrawer keeps client-side search (no need for server roundtrip on name filter) while eventType filter is passed as query param (server-side for cleaner data)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created enhance-template API route**
- **Found during:** Task 2 (CreateFromTemplateWizard)
- **Issue:** Wizard needs to call `enhanceTemplateForReuse` via API, but no route existed for this AI function (Plan 03 only created 5 AI routes: create-from-description, generate-schedule, generate-summary; enhance-template was not included)
- **Fix:** Created `src/app/api/events/ai/enhance-template/route.ts` with Zod validation, permission check (EVENT_PROJECT_CREATE), and org-scoped call to enhanceTemplateForReuse
- **Files modified:** src/app/api/events/ai/enhance-template/route.ts (new file)
- **Verification:** TypeScript compilation passes, route follows standard API pattern
- **Committed in:** d754e44 (Task 2 commit)

---

**Total deviations:** 1 auto-added (1 missing critical functionality)
**Impact on plan:** Necessary for wizard to function — no scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in __tests__/lib/assistant-prompt.test.ts and several integration route files (from other plans); none in our new files. Out of scope, not fixed.

## User Setup Required
None — no external service configuration required beyond GEMINI_API_KEY already documented in CLAUDE.md.

## Next Phase Readiness
- Template UI complete — all 3 components ready for use
- TemplateListDrawer + CreateFromTemplateWizard can be wired into the events list page (Plan 10) for the "New from Template" creation path
- Save as Template button active on eligible events immediately
- enhance-template route available for any future AI template features

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: src/lib/hooks/useEventTemplates.ts
- FOUND: src/components/events/templates/SaveAsTemplateDialog.tsx
- FOUND: src/components/events/templates/TemplateListDrawer.tsx
- FOUND: src/components/events/templates/CreateFromTemplateWizard.tsx
- FOUND: src/app/api/events/ai/enhance-template/route.ts
- FOUND: commit a502a86 (Task 1)
- FOUND: commit d754e44 (Task 2)
