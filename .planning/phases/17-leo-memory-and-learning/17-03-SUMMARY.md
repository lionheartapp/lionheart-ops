---
phase: 17-leo-memory-and-learning
plan: "03"
subsystem: ai-memory
tags: [pgvector, embeddings, semantic-search, gemini, ai-tools]

requires:
  - phase: 17-01
    provides: embeddingService with generateEmbedding/searchSimilar/generateAndStoreEmbedding
provides:
  - recall_context tool registered in Leo's toolset (semantic search across tickets/events/inventory/conversations)
  - embeddingTriggers.ts with embedTicket/embedCalendarEvent/embedInventoryItem fire-and-forget functions
  - Embedding generation wired into ticket/calendar-event/inventory-item create routes
affects: [src/lib/services/ai, src/app/api/tickets, src/app/api/calendar-events, src/app/api/inventory]

tech-stack:
  added: []
  patterns: [fire-and-forget-embedding-trigger, void-async-pattern, semantic-scope-filtering, time-range-sql-filter]

key-files:
  created:
    - src/lib/services/ai/tools/memory.tools.ts
    - src/lib/services/ai/embeddingTriggers.ts
  modified:
    - src/lib/services/ai/assistant-tools.ts
    - src/lib/services/ai/assistant.service.ts
    - src/app/api/tickets/route.ts
    - src/app/api/calendar-events/route.ts
    - src/app/api/inventory/route.ts

key-decisions:
  - "recall_context uses Promise.allSettled across scopes — one failed scope (e.g. no embeddings yet) does not break results from other scopes"
  - "Time-range filter built as raw SQL fragment (AND createdAt > ...) passed to searchSimilar opts.filters — avoids additional Prisma query"
  - "Inventory route has two creation paths (AV Equipment + legacy simple form); both get embedding triggers to ensure complete coverage"
  - "embedTicket/embedCalendarEvent/embedInventoryItem are sync functions with internal void async — callers never need to await or catch"

patterns-established:
  - "Fire-and-forget embedding: sync wrapper → void (async () => { await generateAndStoreEmbedding(...) })()"
  - "Recall scope dispatch: string enum switch building parallel searchSimilar calls with Promise.allSettled"
  - "Memory tool self-registration via registerTools() in module initializer — consistent with all other *.tools.ts files"

requirements-completed: [LEO-MEM-03, LEO-MEM-04]

duration: 3min
completed: 2026-03-11
---

# Phase 17 Plan 03: Leo Semantic Search Summary

**recall_context tool (semantic search over tickets/events/inventory/conversations) registered in Leo's toolset, with fire-and-forget embedding triggers on 3 create routes using pgvector + Gemini text-embedding-004.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-11T00:06:32Z
- **Completed:** 2026-03-11T00:09:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `memory.tools.ts` with a `recall_context` tool supporting scope filtering (tickets/events/inventory/conversations/all) and time-range filtering (week/month/quarter/year/all)
- Created `embeddingTriggers.ts` with three fire-and-forget helpers (embedTicket, embedCalendarEvent, embedInventoryItem) that never block or throw
- Wired embedding triggers into 3 POST routes: tickets, calendar-events, and inventory (both AV and legacy paths)
- Added Memory & recall capability to Leo's system prompt
- All TypeScript compiles cleanly with 0 errors

## Task Commits

1. **Task 1: Create recall_context tool and embedding triggers** - `4ea8d32` (feat)
2. **Task 2: Wire embedding triggers into existing create/update routes** - `2eaccbe` (feat)

## Files Created/Modified

- `src/lib/services/ai/tools/memory.tools.ts` — recall_context tool with scope/time-range filtering and per-type record enrichment
- `src/lib/services/ai/embeddingTriggers.ts` — embedTicket, embedCalendarEvent, embedInventoryItem fire-and-forget functions
- `src/lib/services/ai/assistant-tools.ts` — added `import './tools/memory.tools'` barrel import
- `src/lib/services/ai/assistant.service.ts` — added Memory & recall capability line for system prompt
- `src/app/api/tickets/route.ts` — embedTicket call after createTicket in POST handler
- `src/app/api/calendar-events/route.ts` — embedCalendarEvent call after createEvent in POST handler
- `src/app/api/inventory/route.ts` — embedInventoryItem calls in both AV Equipment and legacy POST paths

## Decisions Made

- **recall_context uses Promise.allSettled:** One failed scope (e.g., no embeddings yet for a table) does not break results from other scopes — graceful partial results.
- **Time-range as raw SQL fragment:** Built as `AND "createdAt" > '...'` passed to `searchSimilar`'s `opts.filters` — avoids an extra Prisma query and keeps the embedding service interface generic.
- **Both inventory creation paths get triggers:** The route has two branches (AV Equipment 2-step form + legacy simple form). Both now emit embeddings to ensure complete coverage.
- **Sync wrapper pattern for fire-and-forget:** `embedTicket(id, data)` is a sync function containing `void (async () => { ... })()` — callers use simple `void embedTicket(...)` with no `await` needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type predicate error on Promise.allSettled filter**
- **Found during:** Task 1 (Create recall_context tool)
- **Issue:** `filter((r): r is PromiseFulfilledResult<NonNullable<unknown>>` produced TS2677 — type predicate not assignable to parameter type due to complex union return type
- **Fix:** Changed to `.filter((r) => ...)` with `.map((r) => (r as PromiseFulfilledResult<unknown>).value)` — simpler cast avoids the predicate complexity
- **Files modified:** src/lib/services/ai/tools/memory.tools.ts
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** 4ea8d32 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Minor TypeScript fix during initial compile. No scope creep.

## Issues Encountered

None beyond the TypeScript type predicate fix above.

## User Setup Required

None — no external service configuration required. GEMINI_API_KEY already configured. Embedding triggers gracefully degrade when API key is absent.

## Next Phase Readiness

- Plan 17-03 complete. Semantic search infrastructure is now live.
- Leo can call `recall_context` during conversations to find past tickets, events, inventory items, and conversation messages by meaning.
- New data (tickets, calendar events, inventory items) automatically gets embeddings on creation.
- Ready for Plan 17-04 (conversation memory persistence wire-up) or Plan 17-05 (UserMemoryFact extraction).

---
*Phase: 17-leo-memory-and-learning*
*Completed: 2026-03-11*
