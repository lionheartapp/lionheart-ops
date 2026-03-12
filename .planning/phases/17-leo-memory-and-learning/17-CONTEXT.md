# Phase 17: Leo Memory & Learning - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning
**Source:** Leo Learning & Memory Research Document

<domain>
## Phase Boundary

This phase adds persistent memory, semantic recall, and user profiling to Leo (the AI assistant). Leo currently has zero memory between sessions — conversations live only in browser state. This phase makes Leo context-aware across sessions by:

1. Persisting conversations to PostgreSQL
2. Generating pgvector embeddings on organizational data (tickets, events, inventory)
3. Adding a `recall_context` tool for semantic search over history
4. Building per-user profiles with learned preferences
5. Adding feedback (thumbs up/down) to Leo's messages
6. Compressing long conversations into summaries

</domain>

<decisions>
## Implementation Decisions

### Database Schema
- `Conversation` model: org-scoped, belongs to user, has title + metadata
- `ConversationMessage` model: role (user/assistant/tool_call/tool_result), content, tokenCount, feedbackScore, toolName, toolSuccess
- `ConversationSummary` model: compressed summary of older messages in a conversation
- `UserAssistantProfile` model: one-per-user, stores learned preferences (responseLength, tonePreference, frequentTopics, commonActions, domainExpertise, communicationStyle)
- `UserMemoryFact` model: individual facts extracted from conversations (factText, category, importance score with decay)
- Embedding columns use `Unsupported("vector(768)")` in Prisma, managed via raw SQL + pgvector

### Vector Infrastructure
- Enable pgvector extension on Supabase
- Use Gemini Embedding API (768 dimensions, truncated from 3072 via Matryoshka learning)
- HNSW indexes for O(log n) approximate nearest neighbor search
- Add embedding columns to: Ticket, Event (CalendarEvent), InventoryItem, ConversationMessage, UserMemoryFact
- Use `pgvector/utils` npm package for SQL serialization

### Conversation Persistence
- Modify `/api/assistant/chat` route to save each message to ConversationMessage table
- Add `/api/conversations` CRUD routes (list, get, delete)
- Frontend: add conversation sidebar list to Leo's UI, load history on click
- Frontend keeps existing streaming UX — just also persists messages server-side

### Feedback System
- Thumbs up (5) / thumbs down (1) buttons on each assistant message
- Stored on `ConversationMessage.feedbackScore`
- Track tool call outcomes: `toolName`, `toolSuccess`

### recall_context Tool
- New Leo tool that searches organizational history semantically
- Parameters: query (text), search_scope (tickets/events/conversations/all), time_range
- Uses pgvector cosine similarity search across embedded records
- Leo calls this automatically when it detects questions about history, patterns, or "last time we did X"

### User Profile & Memory Extraction
- Background process runs after conversation ends (or after 10+ messages)
- Uses Gemini to extract facts, preferences, patterns from conversation
- Merges into UserAssistantProfile (weights updated, unused facts decay)
- Profile injected into Leo's system prompt (token-budgeted)

### Context Assembly (4-Layer)
- L1: Current message (always included)
- L2: Last 5-10 messages verbatim (40% of token budget)
- L3: Summaries of older conversation turns (20% of budget)
- L4: Semantically relevant facts from past sessions (20% of budget)

### Claude's Discretion
- Exact token budget allocation per layer
- Background extraction timing (end of conversation vs. periodic)
- Conversation list UI design (sidebar vs. dropdown vs. separate page)
- Embedding backfill strategy for existing data (batch size, rate limiting)
- Memory fact importance decay algorithm details

</decisions>

<specifics>
## Specific Ideas

- Gemini Embedding model: `text-embedding-004` at 768 dimensions
- HNSW index params: `m = 16, ef_construction = 200` for recall/speed balance
- Cost estimate: ~$0.50/year for small school, ~$5/year for large district
- Embedding storage: ~3KB per 768-dim vector
- Leo greeting with context: "Morning, Michael. Quick heads up — there are 3 new tickets since Friday..."
- Leo pattern detection: "This is the fourth report of gym floor issues in 12 months..."
- Conversation auto-title from first user message
- User-viewable profile page (see/edit what Leo knows about them)

</specifics>

<deferred>
## Deferred Ideas

- L3 memory compression pipeline (summarization of very old conversations) — implement basic version, defer advanced compression
- Intelligence feedback loop (monthly analysis of feedback data to tune system prompt)
- Proactive suggestions ("I noticed a pattern...")
- Gemini 2.5 Flash upgrade for better reasoning
- Cross-user organizational memory (shared knowledge across all users in an org)

</deferred>

---

*Phase: 17-leo-memory-and-learning*
*Context gathered: 2026-03-11 from Leo Learning & Memory Research Document*
