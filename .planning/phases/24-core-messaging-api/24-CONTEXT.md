# Phase 24: Core Messaging API - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Every channel and message operation has a working, permissioned REST API that can be smoke-tested independently before any UI or Realtime code touches it. Covers: channel CRUD, member management, DMs (1:1 and group), message send/edit/delete, @mention parsing, and full-text search.

Requirements: CHAN-01 through CHAN-07, MSG-01 through MSG-03, MSG-07, SRCH-01, SRCH-02.

</domain>

<decisions>
## Implementation Decisions

### API Route Structure
- **D-01:** All messaging routes nested under `/api/messaging/*`. Routes:
  - `/api/messaging/channels` — GET (list), POST (create)
  - `/api/messaging/channels/[id]` — GET, PATCH, DELETE (archive)
  - `/api/messaging/channels/[id]/members` — GET, POST, DELETE
  - `/api/messaging/channels/[id]/messages` — GET (paginated), POST (send)
  - `/api/messaging/messages/[id]` — PATCH (edit), DELETE (soft-delete)
  - `/api/messaging/dms` — POST (find-or-create)
  - `/api/messaging/search` — GET
- **D-02:** messagingEnabled gated at the middleware level — a single check in `src/middleware.ts` returns 403 for any `/api/messaging/*` route when the org's messagingEnabled is false. No per-route boilerplate needed.

### Service Layer
- **D-03:** Two service files:
  - `src/lib/services/channelService.ts` — createChannel, getChannels, updateChannel, archiveChannel, getChannelMembers, addMember, removeMember, findOrCreateDM, createGroupDM
  - `src/lib/services/messageService.ts` — sendMessage, editMessage, deleteMessage, getMessages (paginated), searchMessages, parseMentions

### Channel Creation and DM Flow
- **D-04:** Creator auto-joins as owner — when a user creates a channel, they are immediately added as a ChannelMember with role='owner'.
- **D-05:** DMs use find-or-create pattern — POST `/api/messaging/dms` with `{ userIds: [...] }`. If a DM/GROUP_DM channel already exists between those exact users, return it. Otherwise create one. Prevents duplicate DM channels.
- **D-06:** Group DM max 8 members. Larger conversations should create a proper channel.

### Message Operations and Permissions
- **D-07:** @mentions parsed server-side on send. `messageService.parseMentions(content, channelId)` extracts @user, @channel, @here, @team references and creates MessageMention rows. Enables notification routing without re-parsing.
- **D-08:** Message deletion: users can soft-delete their own messages. Only admin-tier roles (users with `messages:delete:any` permission — admin, head-of-schools, principal) can delete any message. Matches Phase 23 permission matrix.
- **D-09:** Message editing: users can edit their own messages only. editedAt timestamp set on update. No permission for editing others' messages.

### Message Pagination
- **D-10:** Cursor-based pagination with before/after — `GET /channels/[id]/messages?before=msgId&limit=50`. Returns `{ messages, hasMore, cursor }`. Matches existing cursor-based pagination pattern. Efficient for infinite scroll in Phase 26.

### Search
- **D-11:** Dedicated search endpoint — `GET /api/messaging/search?q=term&channelId=optional&limit=20&cursor=msgId`. Uses tsvector GIN index from Phase 23. Returns messages with channel name, sender, and date. Scoped to user's accessible channels via org-scoped Prisma + channel membership check.

### Claude's Discretion
- Zod validation schemas for each route
- Exact Prisma query shapes and includes
- Error messages and edge case handling
- How channel slug generation works (auto from name, or user-provided)
- Whether to include message count in channel list response
- How to efficiently check "exact same users" for DM find-or-create (sorted userId hash or query)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — CHAN-01 through CHAN-07, MSG-01 through MSG-03, MSG-07, SRCH-01, SRCH-02
- `.planning/ROADMAP.md` §Phase 24 — Success criteria and dependency chain

### Phase 23 Foundation (depends on)
- `.planning/phases/23-schema-permissions-and-rls-foundation/23-CONTEXT.md` — Schema decisions (D-07 through D-10: DMs are channels, thread replies, reactions, unread counter)
- `.planning/phases/23-schema-permissions-and-rls-foundation/23-01-SUMMARY.md` — 8 Prisma models created, MessagingNotificationPreference rename
- `.planning/phases/23-schema-permissions-and-rls-foundation/23-02-SUMMARY.md` — Permission constants and role mappings
- `prisma/schema.prisma` — Messaging models (Channel, ChannelMember, Message, etc.)

### Existing Patterns to Follow
- `src/lib/api/with-auth.ts` — withAuth wrapper (auth, permissions, Zod parsing, error classification)
- `src/lib/permissions.ts` — PERMISSIONS.MESSAGING_* constants
- `src/lib/services/eventChatService.ts` — Closest existing pattern for message-like CRUD
- `src/middleware.ts` — Where to add messagingEnabled gate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withAuth` wrapper — handles auth, org context, permissions, Zod body parsing, and error classification. All messaging routes should use this.
- `PERMISSIONS.MESSAGING_*` constants — 5 messaging permissions already defined in Phase 23
- `storageService.ts` — Supabase Storage service for file attachments (MSG-08 in Phase 27, but attachment URL resolution needed here)
- Cursor-based pagination pattern — used across tickets, events, inventory

### Established Patterns
- Route handlers use `withAuth(handler, { permission, schema })` — eliminates boilerplate
- Services are stateless functions that accept userId/orgId and use org-scoped `prisma`
- Zod schemas validate all input at the route level
- `ok(data)` / `fail(code, message)` response envelope

### Integration Points
- `src/middleware.ts` — add messagingEnabled check for `/api/messaging/*` paths
- `src/lib/db/index.ts` — org-scoped Prisma already knows about all 8 messaging models
- `src/lib/services/` — new channelService.ts and messageService.ts

</code_context>

<specifics>
## Specific Ideas

- DM find-or-create should be idempotent — calling with the same userIds returns the same channel every time
- Channel slug auto-generated from name (slugify), with uniqueness check per org (@@unique([organizationId, slug]) already in schema)
- Message GET should include author info (name, avatar) via Prisma include to avoid N+1 on the client
- Search results should return enough context (channel name, sender name/avatar, message snippet) to be useful without a second roundtrip

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-core-messaging-api*
*Context gathered: 2026-05-07*
