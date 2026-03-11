---
phase: 14-ai-assistant-ux-upgrade
plan: 01
subsystem: ui
tags: [react, framer-motion, sse, streaming, ai-assistant, gemini]

# Dependency graph
requires:
  - phase: 08-auth-hardening-and-security
    provides: JWT auth and org-scoped API routes
provides:
  - ChoiceButtons component with Framer Motion stagger and aurora gradient hover
  - SuggestionChips component with horizontal scroll and AnimatePresence exit
  - Extended StreamEvent union with choices, suggestions, and rich_confirmation types
  - RichConfirmationCardData interface (type contract for Plan 14-03)
  - extractMarkers() function parsing [CHOICES:] and [SUGGEST:] from completed SSE text
  - System prompt Structured Response Formats section instructing Leo to use markers
  - ConversationTurn extended with optional choices/suggestions fields
affects:
  - 14-02-ai-assistant-room-weather-resources (new tools that produce suggestions)
  - 14-03-rich-confirmation-card (consumes rich_confirmation SSE event and RichConfirmationCardData)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE marker extraction: Parse [CHOICES:] and [SUGGEST:] from completed text (not mid-stream) to avoid partial marker false positives
    - Typeform-style chat UI: Tappable choice pills + suggestion chips replace free-text follow-up
    - SSE event extension: Add new event types to StreamEvent union, handle in switch statement, store on ConversationTurn

key-files:
  created:
    - src/components/ai/ChoiceButtons.tsx
    - src/components/ai/SuggestionChips.tsx
  modified:
    - src/lib/types/assistant.ts
    - src/lib/services/ai/assistant.service.ts
    - src/app/api/ai/assistant/chat/route.ts
    - src/components/ai/MessageList.tsx
    - src/components/ai/ChatPanel.tsx

key-decisions:
  - "Marker extraction happens on completed finalText (not mid-stream delta chunks) to prevent partial marker false positives when markers span multiple chunks"
  - "rich_confirmation is a separate SSE event type (not embedded in action_confirmation) per CONTEXT.md locked decision"
  - "Plan 14-03 will add richCard field to ActionConfirmation type; ChatPanel uses as any cast temporarily"
  - "ChoiceButtons and SuggestionChips only render on the last assistant message and only when not streaming/loading"
  - "Choices/suggestions are cleared from conversation state before each new user message send"

patterns-established:
  - "SSE marker pattern: LLM appends [CHOICES: A | B | C] or [SUGGEST: X | Y] at end of response; route extracts and emits as separate SSE events"
  - "Choice/suggestion lifecycle: appear after streaming ends, cleared on next user message send"
  - "New SSE event types follow same write() pattern as existing types, stored on ConversationTurn for component consumption"

requirements-completed:
  - AI-UX-01
  - AI-UX-02

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 14 Plan 01: AI Assistant UX Upgrade — Interactive Choices and Suggestion Chips Summary

**Typeform-style chat UI via SSE markers: [CHOICES:] and [SUGGEST:] extracted from completed Gemini output, emitted as structured events, and rendered as tappable ChoiceButtons and SuggestionChips in the chat panel**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T13:39:30Z
- **Completed:** 2026-03-11T13:43:38Z
- **Tasks:** 2
- **Files modified:** 7 (5 modified, 2 created)

## Accomplishments

- Extended the SSE streaming pipeline with three new event types: `choices`, `suggestions`, and `rich_confirmation` (including `RichConfirmationCardData` interface for Plan 14-03)
- Built `ChoiceButtons` (stagger-animated tappable pills with aurora gradient hover) and `SuggestionChips` (horizontal scroll chips with AnimatePresence) as standalone Framer Motion components
- Wired the full lifecycle: system prompt instructs Leo to use markers, route extracts them post-stream, SSE events flow to ChatPanel, stored on ConversationTurn, rendered in MessageList, cleared on new message

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, system prompt, and SSE marker parsing** - `3c79789` (feat)
2. **Task 2: Create ChoiceButtons, SuggestionChips, and wire into MessageList + ChatPanel** - `de6720a` (feat)

**Plan metadata:** (pending — docs commit)

## Files Created/Modified

- `src/lib/types/assistant.ts` - Added RichConfirmationCardData interface, extended StreamEvent union with choices/suggestions/rich_confirmation, added optional choices/suggestions to ConversationTurn
- `src/lib/services/ai/assistant.service.ts` - Added Structured Response Formats section to Leo system prompt with [CHOICES:] and [SUGGEST:] marker instructions; added capability stubs for plan 14-02 tools
- `src/app/api/ai/assistant/chat/route.ts` - Added extractMarkers() function, updated ConversationTurnSchema Zod validation, emit choices/suggestions SSE events after marker extraction, store on conversation history
- `src/components/ai/ChoiceButtons.tsx` - NEW: Tappable pill buttons with Framer Motion staggerContainer/listItem entrance and aurora gradient hover state
- `src/components/ai/SuggestionChips.tsx` - NEW: Horizontal scrollable chip row with AnimatePresence fade-in/exit animation
- `src/components/ai/MessageList.tsx` - Added onChoiceSelect/onSuggestionSelect props, renders ChoiceButtons/SuggestionChips below last assistant message, added tool labels for plan 14-02 tools
- `src/components/ai/ChatPanel.tsx` - Added choices/suggestions/rich_confirmation SSE event handlers, clears choices/suggestions on new message, passes selection callbacks to MessageList

## Decisions Made

- Marker extraction at end of streaming (on completed `finalText`) prevents false positives from markers split across delta chunks (e.g., `[CHOICES: Chapel |` in one chunk, `Athletic Event]` in the next)
- `rich_confirmation` is a separate SSE event type per CONTEXT.md locked decision; ChatPanel stores with temporary `as any` cast until Plan 14-03 adds the `richCard` field to `ActionConfirmation`
- System prompt instructs Leo with "IMPORTANT: Do NOT use both [CHOICES:] and [SUGGEST:] in the same response" to prevent ambiguous state
- Choice/suggestion visibility: only on the last assistant turn, only when not streaming, only when not loading

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Two pre-existing TypeScript errors in `src/lib/services/ai/assistant-tools.ts` (referencing non-existent `capacity` and `quantity` Prisma fields) were present before this plan's changes. These are out-of-scope per deviation rule boundary and have been logged for deferred resolution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 14-02 can now add `check_room_availability`, `get_weather_forecast`, and `check_resource_availability` tools; the system prompt capability stubs and MessageList tool labels are already in place
- Plan 14-03 can consume the `rich_confirmation` SSE event and `RichConfirmationCardData` interface — both are defined and the ChatPanel already handles the event (stores via `as any`; Plan 14-03 will add proper typing)
- The `[CHOICES:]` and `[SUGGEST:]` markers are already flowing end-to-end; Plan 14-02 tool responses can trigger Leo to include them

## Self-Check: PASSED

All 7 target files exist. Both task commits (3c79789, de6720a) confirmed in git log. TypeScript compiles with zero errors (2 pre-existing errors in out-of-scope assistant-tools.ts not introduced by this plan).

---
*Phase: 14-ai-assistant-ux-upgrade*
*Completed: 2026-03-11*
