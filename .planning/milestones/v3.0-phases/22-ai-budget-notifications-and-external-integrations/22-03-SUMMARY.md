---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 03
subsystem: api
tags: [gemini, ai, prisma, zod, event-templates, event-planning]

# Dependency graph
requires:
  - phase: 21-documents-groups-communication-and-day-of-tools
    provides: EventProject with documents, groups, tasks, scheduleBlocks — template serialization source
  - phase: 22-ai-budget-notifications-and-external-integrations
    provides: Plan 01 budget types, Plan 02 notification schema (EventTemplate already in schema)

provides:
  - EventTemplate Prisma model with JSON templateData (schedule offsets, task shapes, group structure)
  - eventTemplateService: saveAsTemplate, createFromTemplate, getTemplates, getTemplate, deleteTemplate
  - eventAIService: generateEventFromDescription, generateSchedule, estimateBudget, generateStatusSummary, generateNotificationDraft, enhanceTemplateForReuse, analyzeFeedback
  - 5 API routes: /api/events/templates (GET/POST), /api/events/templates/[id] (GET/POST/DELETE), /api/events/ai/create-from-description, /api/events/ai/generate-schedule, /api/events/ai/generate-summary
  - EVENTS_TEMPLATES_MANAGE permission on ADMIN and MEMBER roles

affects:
  - Phase 22 Plan 06 (chat-style event creation wizard — uses create-from-description)
  - Phase 22 Plan 07 (generate-then-edit features — uses generate-schedule, generate-summary)
  - Phase 22 Plan 08 (template system UI — uses all template endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI endpoints return 503 AI_UNAVAILABLE (not 500) when GEMINI_API_KEY is absent"
    - "Two-phase pattern: ?skipAI=true returns raw metrics immediately, full call generates AI summary"
    - "Template serialization strips absolute dates to day offsets, strips IDs and participant data"
    - "extractJSON() handles markdown code block wrapping from Gemini responses"

key-files:
  created:
    - src/lib/types/event-template.ts
    - src/lib/types/event-ai.ts
    - src/lib/services/eventTemplateService.ts
    - src/lib/services/ai/eventAIService.ts
    - src/app/api/events/templates/route.ts
    - src/app/api/events/templates/[id]/route.ts
    - src/app/api/events/ai/create-from-description/route.ts
    - src/app/api/events/ai/generate-schedule/route.ts
    - src/app/api/events/ai/generate-summary/route.ts
  modified:
    - prisma/schema.prisma (EventTemplate model already committed by prior plan execution)
    - src/lib/db/index.ts (EventTemplate in orgScopedModels, already committed)
    - src/lib/permissions.ts (EVENTS_TEMPLATES_MANAGE, already committed)

key-decisions:
  - "EventTemplate model was already included in schema by prior plan — confirmed and validated"
  - "Template data strips absolute dates to dayOffset integers relative to event start for portability"
  - "AI functions return null (not throw) when GEMINI_API_KEY absent — callers handle 503 response"
  - "Two-phase summary pattern matches existing dashboard pattern (?skipAI=true fast path)"
  - "extractJSON() regex handles both raw JSON objects and markdown-fenced code blocks"
  - "documentTypes extraction uses label field (not name) per EventDocumentRequirement schema"
  - "createFromTemplate uses rawPrisma for createMany children (org-scoped auto-inject on parent)"

patterns-established:
  - "AI service pattern: getClient() → null if no key, callGemini() wraps error handling, extractJSON() parses response"
  - "Template CRUD pattern: (prisma as any).eventTemplate for org-scoped access without TS casting issues"
  - "AI endpoint 503 pattern: explicit AI_UNAVAILABLE error code with instructive message for developers"

requirements-completed:
  - AI-01
  - AI-05
  - AI-06
  - AI-08
  - AI-10
  - AI-11

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 22 Plan 03: AI Event Service and Template System Summary

**Gemini-powered event AI service (7 functions) and template CRUD system with day-offset serialization, backed by 5 typed API routes that degrade gracefully to 503 without GEMINI_API_KEY**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T01:54:20Z
- **Completed:** 2026-03-16T02:02:45Z
- **Tasks:** 2
- **Files modified:** 9 created, 3 previously committed by earlier plan runs

## Accomplishments
- AI event service with 7 Gemini-powered functions: event creation from description, schedule generation, budget estimation, status summary, notification drafts, template enhancement, feedback analysis
- Template service: save EventProject as reusable skeleton (strips dates, IDs, participants), create from template (applies day offsets back to absolute dates)
- 5 API routes with standard permission checks, Zod validation, and 503 AI_UNAVAILABLE responses when Gemini key is absent
- EVENTS_TEMPLATES_MANAGE permission added to ADMIN and MEMBER roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Template schema, permissions, and service + AI event service** - `610dde7` (feat)
2. **Task 2: Template and AI API routes** - `6051646` (feat)

## Files Created/Modified
- `src/lib/types/event-template.ts` - ScheduleBlockTemplate, TaskTemplate, GroupTemplate, NotificationRuleTemplate, TemplateData, CreateTemplateInputSchema, CreateFromTemplateInputSchema
- `src/lib/types/event-ai.ts` - AIEventSuggestion, AIScheduleSuggestion, AIBudgetEstimate, AIStatusSummary, AINotificationDraft, AIFeedbackAnalysis, EventStatusInput
- `src/lib/services/eventTemplateService.ts` - getTemplates, getTemplate, saveAsTemplate (day-offset serialization), createFromTemplate (offset → datetime), deleteTemplate
- `src/lib/services/ai/eventAIService.ts` - 7 Gemini functions with graceful null returns on missing API key
- `src/app/api/events/templates/route.ts` - GET (list with optional ?eventType=), POST (save as template)
- `src/app/api/events/templates/[id]/route.ts` - GET (detail), POST (create from template), DELETE
- `src/app/api/events/ai/create-from-description/route.ts` - Natural language → AIEventSuggestion
- `src/app/api/events/ai/generate-schedule/route.ts` - Event params → AIScheduleSuggestion
- `src/app/api/events/ai/generate-summary/route.ts` - Two-phase: ?skipAI=true raw metrics or full AIStatusSummary

## Decisions Made
- Templates store day offsets (not absolute dates) so they are reusable across any future event date
- AI service returns null (not throws) when API key absent — API routes translate to 503 with AI_UNAVAILABLE code
- Two-phase summary endpoint matches the existing `?skipAI=true` pattern from the events dashboard
- DocumentTypes in templates use EventDocumentRequirement.label field (not .name which doesn't exist)
- createFromTemplate uses rawPrisma for child record creation (EventScheduleBlock, EventTask) to avoid double org-scope injection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed EventDocumentRequirement field mismatch**
- **Found during:** Task 1 (eventTemplateService.ts)
- **Issue:** Plan specified using `name` field but EventDocumentRequirement schema has `label` and `documentType` as required fields
- **Fix:** Changed document extraction to use `doc.label` and document creation to include both `label` and `documentType: 'custom'`
- **Files modified:** src/lib/services/eventTemplateService.ts
- **Verification:** TypeScript compilation passes with no errors in new files
- **Committed in:** 610dde7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correct operation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `__tests__/lib/assistant-prompt.test.ts` (missing `importance` field in test fixture) — unrelated to this plan, out of scope

## User Setup Required
None — no external service configuration required beyond GEMINI_API_KEY already documented in CLAUDE.md.

## Next Phase Readiness
- AI service ready for Phase 22 Plans 06/07/08 (event creation wizard, generate-then-edit, template UI)
- Template CRUD endpoints tested via TypeScript compilation — ready for integration with UI components
- generate-summary two-phase pattern established, ready to wire into event overview UI

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*
