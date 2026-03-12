# Leo Learning & Memory: Technical Research

## Can Leo Learn and Get Better Over Time?

**Yes.** Two systems make this possible, and your existing stack (Supabase + pgvector + Gemini embeddings) is ready for both. Here's exactly how.

---

## System 1: Conversation Memory + User Profiles

### The Problem Today

Leo has **zero memory between sessions.** Conversations live in the browser — close the tab, everything is gone. Leo can't remember that you always ask about Lincoln Elementary, that you prefer short answers, or that the gym has had 4 plumbing issues this year.

### The Solution: 4-Tier Memory Hierarchy

Production AI assistants (Mem0, MemGPT, Apple's PLUM) all use the same layered approach:

| Layer | What It Is | Where It Lives | How Long It Lasts |
|-------|-----------|----------------|-------------------|
| **L1: Working Memory** | Current message + tool results | In the Gemini request | One turn |
| **L2: Session Memory** | Last 10-20 messages verbatim | In-memory (frontend state, like today) | One conversation |
| **L3: Session Summary** | Compressed summary of older turns | PostgreSQL `ConversationSummary` table | Forever |
| **L4: Long-Term Profile** | Extracted facts, preferences, patterns | PostgreSQL `UserProfile` + `MemoryFact` tables with vector embeddings | Forever |

**How it works at request time:**

```
User sends message
    ↓
Build context from all 4 layers (with token budgeting):
  - L1: Current message (always included)
  - L2: Last 5-10 messages verbatim (40% of budget)
  - L3: Summaries of older conversation turns (20% of budget)
  - L4: Semantically relevant facts from past sessions (20% of budget)
    ↓
Inject into Gemini system prompt
    ↓
Leo responds with full context awareness
```

### Database Schema (New Prisma Models)

```prisma
model Conversation {
  id             String    @id @default(uuid())
  userId         String
  organizationId String
  title          String?          // Auto-generated from first message
  metadata       Json?            // Topic tags, outcome, mood
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User     @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  messages       ConversationMessage[]
  summaries      ConversationSummary[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([organizationId])
}

model ConversationMessage {
  id             String    @id @default(uuid())
  conversationId String
  role           String           // 'user' | 'assistant' | 'tool_call' | 'tool_result'
  content        String
  tokenCount     Int?
  toolName       String?          // If this was a tool call, which tool
  toolSuccess    Boolean?         // Did the tool call succeed?
  feedbackScore  Int?             // 1 (thumbs down) or 5 (thumbs up)
  createdAt      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  // embedding stored via raw SQL (pgvector), not natively in Prisma
  // embedding vector(768) — added via migration

  @@index([conversationId, createdAt(sort: Desc)])
}

model ConversationSummary {
  id             String    @id @default(uuid())
  conversationId String
  summaryText    String
  messageCount   Int              // How many messages this summarizes
  tokenCount     Int?
  createdAt      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId])
}

model UserAssistantProfile {
  id             String    @id @default(uuid())
  userId         String    @unique
  organizationId String

  // Explicit preferences (user can set these)
  responseLength String?          // 'brief' | 'detailed' | 'executive'
  tonePreference String?          // 'casual' | 'professional' | 'friendly'

  // Learned preferences (extracted automatically)
  frequentTopics Json?            // [{ topic: "plumbing", weight: 0.8 }, ...]
  commonActions  Json?            // [{ action: "create_ticket", count: 47 }, ...]
  domainExpertise Json?           // ["facilities", "IT", "events"]
  communicationStyle Json?        // { avgMessageLength, asksFollowUps, prefersData }

  // Stats
  conversationCount Int @default(0)
  totalMessages     Int @default(0)
  lastActiveAt      DateTime?
  updatedAt         DateTime @updatedAt

  user           User @relation(fields: [userId], references: [id])

  @@index([organizationId])
}

model UserMemoryFact {
  id                   String    @id @default(uuid())
  userId               String
  organizationId       String
  factText             String           // "Michael usually reports gym plumbing issues"
  category             String?          // 'preference' | 'pattern' | 'domain' | 'relationship'
  importance           Float   @default(0.5)  // 0-1, decays over time
  sourceConversationId String?
  lastReferencedAt     DateTime?
  createdAt            DateTime @default(now())

  user                 User @relation(fields: [userId], references: [id])

  // embedding vector(768) — added via migration (pgvector)

  @@index([userId, importance(sort: Desc)])
  @@index([organizationId])
}
```

### How Leo Learns From Each Conversation

After every conversation ends (or after 10+ messages), a background process runs:

**Step 1: Extract facts** — A lightweight Gemini call analyzes the conversation and pulls out anything worth remembering:

```
"Analyze this conversation and extract:
1. User preferences expressed (response format, communication style)
2. Facts worth remembering (locations they care about, recurring issues)
3. Domain expertise demonstrated
4. Patterns (do they always ask about the same building? same type of ticket?)

Return as JSON."
```

**Step 2: Merge into profile** — New facts get merged with the existing `UserAssistantProfile`. Weights are updated: facts referenced more often become more important, old unused facts decay.

**Step 3: Generate embeddings** — Key messages and extracted facts get embedded (Gemini Embedding, 768 dimensions) and stored with pgvector for semantic retrieval later.

**Step 4: Summarize** — If the conversation is long, older messages get compressed into a `ConversationSummary` (1-2 sentences preserving names, decisions, and outcomes).

### What Leo Would "Know" After 30 Days

After a month of regular use, Leo's profile for a user like Michael might contain:

```json
{
  "frequentTopics": [
    { "topic": "gym_maintenance", "weight": 0.9 },
    { "topic": "plumbing", "weight": 0.7 },
    { "topic": "event_scheduling", "weight": 0.6 }
  ],
  "commonActions": [
    { "action": "create_maintenance_ticket", "count": 23 },
    { "action": "query_maintenance_stats", "count": 15 },
    { "action": "list_upcoming_events", "count": 12 }
  ],
  "communicationStyle": {
    "avgMessageLength": 18,
    "prefersShortResponses": true,
    "asksFollowUps": false
  }
}
```

And memory facts like:
- "Michael manages facilities at Lincoln Elementary"
- "The gym at Lincoln has recurring plumbing issues — 4 reports in 6 months"
- "Michael prefers tickets assigned to Carlos for plumbing work"
- "Michael checks maintenance stats every Monday morning"

Leo would greet Michael differently: *"Morning, Michael. Quick heads up — there are 3 new tickets since Friday, and I noticed another plumbing flag in the gym. Want me to check the history?"*

---

## System 2: RAG Over Organizational Knowledge

### The Problem Today

Leo can only see data through its tools — it calls `query_maintenance_stats` or `search_platform` and gets structured results. It has no way to notice patterns across data, connect related tickets, or learn from resolution history.

### The Solution: Embed Your Data, Search Semantically

Instead of Leo only doing exact queries, you embed your organizational data (tickets, events, device records, room notes) as vectors. When a user asks a question, Leo searches for semantically similar records and uses them as context.

### Your Stack Is Ready

**pgvector v0.8.0** is already available on your Supabase project. You just need to enable it:

```sql
CREATE EXTENSION vector;
```

**Gemini Embedding** models are production-ready:

| Model | Dimensions | Cost | Best For |
|-------|-----------|------|----------|
| Gemini Embedding 1 | 768 (truncated from 3072) | $0.15/1M tokens | Text search, ticket matching |
| Gemini Embedding 2 | 768 (truncated from 3072) | $0.20/1M tokens | Multimodal (text + images) |

**Recommended: 768 dimensions.** Saves 75% storage vs. full 3072 with minimal quality loss (Google's Matryoshka learning makes this work).

### What Gets Embedded

| Data Type | When Embedded | What Gets Embedded | Use Case |
|-----------|--------------|-------------------|----------|
| Maintenance Tickets | On create + update | Title + description + category + location + resolution notes | "Show me similar issues to this leak" |
| Events | On create + update | Title + description + location + attendees | "Find events like last year's science fair" |
| IT Tickets | On create + update | Title + description + device info + resolution | "Has this device had issues before?" |
| Inventory Items | On create | Name + description + category + location | "What equipment do we have for outdoor events?" |
| Ticket Comments | On create | Comment text + context | "What did the technician say about the HVAC last time?" |
| Conversation Summaries | On summarize | Summary text | "What did we discuss about the gym renovation?" |

### How It Works in Practice

```
User: "The gym floor is buckling again"

Step 1: Embed the query → vector(768)

Step 2: Search tickets table:
  SELECT id, title, description, status, "createdAt"
  FROM "Ticket"
  WHERE organizationId = $orgId
  ORDER BY embedding <=> $queryVector
  LIMIT 5

Step 3: Returns 3 past tickets:
  - "Gym floor warping near entrance" (DONE, March 2025)
  - "Water damage causing gym floor buckling" (DONE, August 2025)
  - "Gym plumbing leak under floor" (DONE, January 2026)

Step 4: Leo sees the pattern and responds:
  "This is the fourth report of gym floor issues in 12 months.
   The last three were all linked to plumbing leaks underneath.
   I'd recommend creating an URGENT ticket and flagging it as a
   recurring structural issue. Want me to draft that and include
   the history?"
```

**This is the leap.** Leo goes from "I'll create a ticket for you" to "I see a pattern here, and I think this is a bigger problem."

### Prisma + pgvector Integration

Prisma v5.22 doesn't natively support vector columns, but the workaround is clean:

```prisma
// In schema.prisma — mark as Unsupported
model Ticket {
  // ... existing fields ...
  embedding Unsupported("vector(768)")?
}
```

```typescript
// In code — use raw SQL for vector operations
import pgvector from 'pgvector/utils';

// Generate embedding
const embedding = await geminiEmbed(text, { dimensions: 768 });

// Store
await rawPrisma.$executeRaw`
  UPDATE "Ticket"
  SET embedding = ${pgvector.toSql(embedding)}::vector
  WHERE id = ${ticketId}
`;

// Search
const similar = await rawPrisma.$queryRaw`
  SELECT id, title, description,
         1 - (embedding <=> ${pgvector.toSql(queryEmbedding)}::vector) as similarity
  FROM "Ticket"
  WHERE "organizationId" = ${orgId}
    AND embedding IS NOT NULL
  ORDER BY embedding <=> ${pgvector.toSql(queryEmbedding)}::vector
  LIMIT 5
`;
```

### Indexing for Performance

```sql
-- HNSW index (fast approximate search, great for < 1M records)
CREATE INDEX idx_ticket_embedding
ON "Ticket" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

CREATE INDEX idx_event_embedding
ON "Event" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

Performance: O(log n) with 99%+ recall. For a school with 10K tickets, searches complete in < 50ms.

### Cost Reality Check

This is shockingly cheap:

| Scenario | Annual Cost |
|----------|-------------|
| Small school (1K tickets, 50 events, 10 queries/day) | ~$0.50/year |
| Large district (10K tickets, 500 events, 50 queries/day) | ~$5/year |
| Embedding generation for all existing data (one-time backfill) | ~$0.30 |

The cost is so low it's essentially free. Storage in pgvector is negligible too — 768-dimensional vectors are ~3KB each.

---

## How Both Systems Work Together

The real power comes when memory and RAG combine:

```
User: "We need to get the gym ready for the science fair next month"

Leo's context assembly:
  1. USER PROFILE → Michael manages facilities, prefers brief responses
  2. MEMORY FACTS → "Last science fair needed 20 tables, AV setup, and parking signs"
  3. SEMANTIC SEARCH (Events) → Last year's science fair event details + resource list
  4. SEMANTIC SEARCH (Tickets) → Setup tickets from last year's science fair
  5. TOOL CALL → check_room_availability for gym on requested date

Leo responds:
  "The gym is available March 28. Based on last year's science fair, you'll
   probably need 20 tables, a projector + mic setup, and parking signage.
   Last year we also created a custodial prep ticket 3 days before.

   Want me to set all of that up?
   [Create Event] [Create Setup Tickets] [Check AV Inventory] [Do It All]"
```

Leo went from "I'll check the room" to "I remember what happened last time and I'll proactively handle the whole thing."

---

## New Leo Tool: `recall_context`

One new tool ties everything together — a tool Leo can call to search its own memory:

```typescript
{
  name: 'recall_context',
  description: 'Search organizational history and user memory for relevant context',
  parameters: {
    query: 'Natural language description of what to find',
    search_scope: 'tickets' | 'events' | 'conversations' | 'all',
    time_range: 'last_month' | 'last_quarter' | 'last_year' | 'all_time'
  }
}
```

Leo would call this automatically when it detects a question that might benefit from historical context — recurring issues, "last time we did X," comparisons, or trend analysis.

---

## Implementation Priority

### Phase 1: Conversation Persistence (Week 1-2)
- Add `Conversation`, `ConversationMessage` tables to Prisma
- Modify chat route to save messages to database
- Modify frontend to load conversation history from API (not just local state)
- Add "conversation list" sidebar to Leo's UI
- Users can resume past conversations

### Phase 2: Feedback Loop (Week 2)
- Add thumbs up/down buttons to Leo's messages
- Log tool call outcomes (confirmed vs. dismissed)
- Store in `ConversationMessage.feedbackScore`
- Weekly report of Leo's performance metrics

### Phase 3: pgvector + Embeddings (Week 3-4)
- Enable pgvector extension
- Add embedding columns to Ticket, Event, InventoryItem
- Build `embeddingService.ts` (Gemini Embedding API integration)
- Backfill existing data with embeddings
- Add `recall_context` tool to Leo
- Create HNSW indexes

### Phase 4: User Profiles (Week 4-5)
- Add `UserAssistantProfile` and `UserMemoryFact` tables
- Build post-conversation extraction pipeline
- Inject user profile into Leo's system prompt
- Add profile settings page (users can see/edit what Leo knows about them)

### Phase 5: Memory Compression (Week 5-6)
- Build conversation summarization pipeline
- Implement L3 (session summaries) and L4 (cross-session facts)
- Add semantic search over conversation history
- Add token budgeting to context assembly

### Phase 6: Intelligence Feedback Loop (Ongoing)
- Analyze feedback data monthly
- Update Leo's system prompt based on what works
- Add proactive suggestions ("I noticed a pattern...")
- Consider Gemini 2.5 Flash upgrade for better reasoning

---

## Sources

- [Gemini Embedding API Documentation](https://ai.google.dev/gemini-api/docs/embeddings)
- [Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching)
- [Supabase pgvector Guide](https://supabase.com/docs/guides/database/extensions/pgvector)
- [pgvector GitHub — HNSW Indexing](https://github.com/pgvector/pgvector)
- [Mem0: Production-Ready AI Agents with Long-Term Memory](https://arxiv.org/abs/2504.19413)
- [Memoria: Scalable Agentic Memory for Conversational AI](https://arxiv.org/abs/2512.12686)
- [Apple ML Research — Learning to Remember User Conversations](https://machinelearning.apple.com/research/on-the-way)
- [Design Patterns for Long-Term Memory in LLM Architectures](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures)
- [LLM Chat History Summarization Guide 2025 (Mem0)](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025)
- [Context Window Management for AI Agents (Maxim)](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
