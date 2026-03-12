---
phase: 17-leo-memory-and-learning
plan: "04"
subsystem: ai-memory
tags: [ai, gemini, pgvector, memory, personalization, embeddings, context-assembly]

# Dependency graph
requires:
  - phase: 17-leo-memory-and-learning-01
    provides: UserMemoryFact and UserAssistantProfile Prisma models, embeddingService (generateEmbedding, searchSimilar, generateAndStoreEmbedding)
  - phase: 17-leo-memory-and-learning-02
    provides: conversationService getMessages, safeAsync fire-and-forget pattern, chat route structure

provides:
  - memoryExtractionService: Gemini-powered post-conversation fact extraction + UserAssistantProfile upsert
  - contextAssemblyService: 3-layer context builder (user profile, semantic memory facts, conversation summaries)
  - Enhanced buildSystemPrompt with personalized "What I Know About You" and "Relevant History" sections
  - Chat route integration: assembleContext before each turn, extractMemoryFromConversation after 5+ messages

affects:
  - 17-leo-memory-and-learning-05
  - 17-leo-memory-and-learning-06
  - src/lib/services/ai/assistant.service.ts (system prompt shape changed)
  - src/app/api/ai/assistant/chat/route.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - memory-extraction-fire-and-forget: post-conversation Gemini extraction runs non-blocking via safeAsync
    - context-assembly-parallel: assembleContext uses Promise.allSettled so one layer failure does not break others
    - semantic-then-fallback: searchSimilar for relevant facts, falls back to importance-ranked if no API key
    - 80-percent-overlap-dedup: word overlap ratio prevents storing near-identical memory facts
    - 2000-char-context-cap: personalized context sections capped to avoid blowing system prompt token budget

key-files:
  created:
    - src/lib/services/ai/memoryExtractionService.ts
    - src/lib/services/ai/contextAssemblyService.ts
  modified:
    - src/lib/services/ai/assistant.service.ts
    - src/app/api/ai/assistant/chat/route.ts

key-decisions:
  - "Memory extraction triggers only when conversation has 5+ messages in history (body.conversationHistory.length + 1) — avoids expensive Gemini calls on short exchanges"
  - "assembleContext uses Promise.allSettled across all 3 layers so a failed profile lookup or summary query does not block fact retrieval"
  - "Semantic search uses AND userId filter via raw SQL string injection with quote-escaped userId — safe for UUID values"
  - "buildPersonalizedContext caps output at 2000 chars (~500 tokens) with '...' truncation — preserves token budget for conversation"
  - "overlapRatio deduplication uses word sets (>3 char words) for efficiency — avoids re-storing semantically identical facts"

patterns-established:
  - "Fire-and-forget memory extraction via safeAsync after SSE done event — extraction failure never impacts user experience"
  - "Graceful degradation pattern for assembled context: all 3 layers optional, empty context = no personalization added (not an error)"

requirements-completed:
  - LEO-MEM-05
  - LEO-MEM-06

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 17 Plan 04: Leo Memory Extraction and Context Assembly Summary

**Gemini-powered post-conversation memory extraction pipeline + 3-layer context assembly system that personalizes Leo's system prompt with user profile, semantic memory facts, and recent summaries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T03:52:37Z
- **Completed:** 2026-03-12T03:55:37Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `memoryExtractionService.ts`: Gemini extracts facts and profile updates from conversation transcripts, stores them as UserMemoryFact records with embeddings, deduplicates via 80% word overlap check
- Created `contextAssemblyService.ts`: assembles user profile + semantically relevant facts (embedding similarity × importance scoring) + recent conversation summaries before each Leo turn
- Enhanced `buildSystemPrompt()` to accept `assembledContext` and append personalized "What I Know About You" and "Relevant History" sections (capped at ~500 tokens)
- Updated chat route: `assembleContext` called before system prompt, `extractMemoryFromConversation` triggered fire-and-forget after 5+ message conversations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create memory extraction service** - `0da607d` (feat)
2. **Task 2: Create context assembly service and enhance system prompt** - `d072bc1` (feat)

## Files Created/Modified

- `src/lib/services/ai/memoryExtractionService.ts` - Post-conversation fact extraction via Gemini, UserAssistantProfile upsert, decayMemoryImportance utility
- `src/lib/services/ai/contextAssemblyService.ts` - 3-layer context builder with semantic search + fallback
- `src/lib/services/ai/assistant.service.ts` - buildSystemPrompt enhanced with AssembledContext param and profile/history sections
- `src/app/api/ai/assistant/chat/route.ts` - assembleContext integration before prompt build, extractMemoryFromConversation after done event

## Decisions Made

- **Memory extraction threshold:** Only fires after 5+ total messages — short exchanges don't contain enough signal to justify a Gemini API call for extraction.
- **Promise.allSettled for context layers:** Each layer (profile, facts, summaries) is independent — one failure should not cascade. allSettled returns partial results instead of rejecting the whole context.
- **Semantic fact scoring:** Facts are ranked by `similarity * importance` so high-importance facts stay relevant even if slightly off-topic, and low-importance but highly matching facts don't dominate.
- **Token budget cap:** 2000 chars (~500 tokens) ceiling on the combined personalized context — preserves room for conversation history and tool descriptions in Gemini's context window.

## Deviations from Plan

None — plan executed exactly as written. All memory operations are fire-and-forget and failure-tolerant as specified. Context assembly falls back gracefully when embeddings or API key are unavailable.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. All features use existing GEMINI_API_KEY. Memory extraction runs automatically after conversations with 5+ messages.

## Next Phase Readiness

- Plan 17-05 can use the extracted UserMemoryFact and UserAssistantProfile data for UI display (memory browser, profile panel)
- Plan 17-06 can call `decayMemoryImportance` in scheduled jobs for long-term memory management
- Memory system is fully operational: Leo learns from every conversation and personalizes future interactions

---
*Phase: 17-leo-memory-and-learning*
*Completed: 2026-03-12*
