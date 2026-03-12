---
phase: 17-leo-memory-and-learning
plan: "01"
subsystem: ai-memory
tags: [prisma, pgvector, embeddings, conversation-persistence, gemini]
dependency_graph:
  requires: []
  provides: [conversation-models, embedding-service, conversation-service, pgvector-infrastructure]
  affects: [src/lib/services/ai, prisma/schema.prisma, src/lib/db/index.ts, src/lib/types/assistant.ts]
tech_stack:
  added: [pgvector (npm), text-embedding-004 (Gemini), HNSW indexes]
  patterns: [lazy-pgvector-init, raw-sql-vector-ops, rawPrisma-explicit-org-scope, graceful-degradation-without-api-key]
key_files:
  created:
    - src/lib/services/ai/embeddingService.ts
    - src/lib/services/ai/conversationService.ts
  modified:
    - prisma/schema.prisma
    - src/lib/db/index.ts
    - src/lib/types/assistant.ts
decisions:
  - "rawPrisma used in conversationService for explicit org scoping (not orgScopedPrisma) to maintain clarity for a service that passes orgId explicitly"
  - "ConversationMessage is org-scoped but NOT soft-deleted — messages are immutable audit records"
  - "pgvector HNSW indexes created lazily on first embedding operation, not at app startup"
  - "Gemini text-embedding-004 at 768 dimensions (Matryoshka truncation from 3072) chosen for balance of quality and storage size"
  - "Organization.conversationMessages reverse relation added to satisfy Prisma relational validation for ConversationMessage"
metrics:
  duration: "4 minutes"
  completed: "2026-03-11"
  tasks_completed: 3
  files_modified: 5
---

# Phase 17 Plan 01: Leo Memory Foundation Summary

**One-liner:** Prisma schema + pgvector infrastructure + Gemini embedding service + conversation CRUD service for Leo's persistent memory system.

## What Was Built

### Schema (prisma/schema.prisma)

Five new models added to support Leo's memory system:

1. **Conversation** — org-scoped, soft-deleted. Links userId to a conversation thread with optional title and metadata. Reverse relations to ConversationMessage, ConversationSummary, and UserMemoryFact.

2. **ConversationMessage** — org-scoped, immutable (no soft-delete). Stores individual chat turns with role, content, token count, tool metadata, and feedback score. Includes `embedding vector(768)` column for semantic search.

3. **ConversationSummary** — Lightweight summary snapshots for long conversations (token budgeting). Not org-scoped (accessed via conversation relation).

4. **UserAssistantProfile** — Per-user preference profile tracking response length preference, tone, frequent topics, communication style, and usage stats.

5. **UserMemoryFact** — Per-user extracted facts with category, importance score, and source conversation link. Includes `embedding vector(768)` for semantic retrieval.

Embedding columns also added to three existing models:
- `Ticket.embedding vector(768)`
- `CalendarEvent.embedding vector(768)`
- `InventoryItem.embedding vector(768)`

### db/index.ts

- `Conversation` and `ConversationMessage` added to `orgScopedModels`
- `Conversation` added to `softDeleteModels` (ConversationMessage excluded — messages are immutable)

### types/assistant.ts

- `ChatRequest.conversationId?: string` — for continuing a persisted conversation
- `ConversationTurn.feedbackScore?: number` — thumbs up/down storage
- `ConversationTurn.messageId?: string` — persisted message ID for feedback targeting
- `StreamEvent` union extended with `{ type: 'conversation_id'; conversationId: string }` — frontend handshake after first message

### embeddingService.ts

- `ensurePgvector()` — lazy-init pgvector extension + 5 HNSW indexes (m=16, ef_construction=200, cosine ops)
- `generateEmbedding(text)` — Gemini text-embedding-004, 768 dims, 2048 char truncation
- `storeEmbedding(tableName, recordId, embedding)` — raw SQL UPDATE with `::vector` cast
- `searchSimilar(tableName, queryEmbedding, opts)` — cosine similarity search with org scoping and custom filters
- `generateAndStoreEmbedding(tableName, recordId, text)` — convenience wrapper

### conversationService.ts

- `createConversation(userId, orgId, title?)` — create org-scoped conversation
- `addMessage(conversationId, opts)` — create message + bump conversation updatedAt
- `getConversations(userId, orgId, opts)` — list with message counts, ordered by updatedAt
- `getConversation(conversationId, orgId)` — single conversation lookup
- `getMessages(conversationId, opts)` — messages oldest-first with feedback/tool metadata
- `updateConversationTitle(conversationId, title)` — auto-title from first message
- `setMessageFeedback(messageId, feedbackScore)` — 1=down, 5=up
- `deleteConversation(conversationId, orgId)` — soft-delete scoped to org

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Organization.conversationMessages reverse relation**
- **Found during:** Task 1 — Prisma validation failed
- **Issue:** ConversationMessage has `organization` relation field requiring reverse relation on Organization model
- **Fix:** Added `conversationMessages ConversationMessage[]` to Organization model
- **Files modified:** prisma/schema.prisma
- **Commit:** 78d3923

**2. [Rule 3 - Blocking] Prisma client not generated before conversationService compile**
- **Found during:** Task 3 — TypeScript errors on rawPrisma.conversation and rawPrisma.conversationMessage
- **Fix:** Ran `npx prisma generate` after schema changes to regenerate client types
- **Files modified:** node_modules/@prisma/client (generated)
- **Commit:** efe2aa3

## Self-Check: PASSED

Files created:
- FOUND: src/lib/services/ai/embeddingService.ts
- FOUND: src/lib/services/ai/conversationService.ts
- FOUND: .planning/phases/17-leo-memory-and-learning/17-01-SUMMARY.md

Commits:
- FOUND: 78d3923 (schema + db + types)
- FOUND: b3018da (embeddingService)
- FOUND: efe2aa3 (conversationService)
