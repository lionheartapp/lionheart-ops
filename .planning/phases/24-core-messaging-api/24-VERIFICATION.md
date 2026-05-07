---
phase: 24-core-messaging-api
verified: 2026-05-07T21:00:00Z
status: passed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Send a message via POST /api/messaging/channels/[id]/messages and verify it persists"
    expected: "201 response with shaped MessageWithAuthor object including authorName, createdAt"
    why_human: "Requires running server with seeded org, auth token, and channel membership"
  - test: "Search messages via GET /api/messaging/search?q=term and verify tsvector results"
    expected: "200 response with results array scoped to user's channels, hasMore, cursor"
    why_human: "Requires running server, seeded messages with tsvector index populated"
  - test: "Verify middleware blocks /api/messaging/* when messagingEnabled=false"
    expected: "403 with FEATURE_DISABLED error code"
    why_human: "Requires running server with an org that has messagingEnabled=false"
---

# Phase 24: Core Messaging API Verification Report

**Phase Goal:** Every channel and message operation has a working, permissioned REST API that can be smoke-tested independently before any UI or Realtime code touches it
**Verified:** 2026-05-07T21:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create, rename, archive, and manage membership for public and private channels via API | VERIFIED | channelService.ts exports createChannel, updateChannel, archiveChannel, addMember, removeMember (610 lines). Route files channels/route.ts (POST+GET), channels/[id]/route.ts (GET+PATCH+DELETE), channels/[id]/members/route.ts (GET+POST+PATCH+DELETE) all exist, import from channelService, and use withAuth. Permission checks via MESSAGING_CHANNELS_CREATE on create and service-layer ownership checks on mutations. |
| 2 | User can start a 1:1 DM and a group DM via API | VERIFIED | channelService.ts exports findOrCreateDM (lines 507-610) with idempotent find-or-create logic, DM vs GROUP_DM type selection, max 8 member cap. dms/route.ts exports POST with FindOrCreateDMSchema and MESSAGING_DMS_SEND permission gate. |
| 3 | User can send, edit, soft-delete, and @mention via API | VERIFIED | messageService.ts exports sendMessage, editMessage, deleteMessage, parseMentions (456 lines). Route files channels/[id]/messages/route.ts (GET+POST) and messages/[id]/route.ts (PATCH+DELETE) exist and wire to service. editMessage checks authorId===userId. deleteMessage takes canDeleteAny boolean from route-level permissions.can() check. parseMentions creates MessageMention rows for @user, @channel, @here, @team patterns. |
| 4 | Message search returns results scoped strictly to the requesting user's org and accessible channels | VERIFIED | messageService.ts searchMessages (lines 376-456) uses rawPrisma.$queryRaw with Prisma.sql tagged templates. SQL filters by organizationId AND channelId IN (user's ChannelMember subquery). search/route.ts exports GET, imports searchMessages and SearchQuerySchema. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/services/channelService.ts` | Channel CRUD + DM + member management | VERIFIED | 610 lines, 5 Zod schemas, 9 exported functions, org-scoped Prisma, permission checks via can() |
| `src/lib/services/messageService.ts` | Message CRUD + pagination + mentions + search | VERIFIED | 456 lines, 3 Zod schemas, 6 exported functions, cursor pagination, tsvector search, mention parsing |
| `src/middleware.ts` | messagingEnabled feature gate | VERIFIED | Lines 358-372: checks pathname.startsWith('/api/messaging/'), queries rawPrisma.organization.messagingEnabled, returns 403 FEATURE_DISABLED |
| `src/app/api/messaging/channels/route.ts` | GET list + POST create | VERIFIED | 22 lines, exports GET and POST, imports from channelService, POST has MESSAGING_CHANNELS_CREATE permission |
| `src/app/api/messaging/channels/[id]/route.ts` | GET + PATCH + DELETE | VERIFIED | 32 lines, exports GET, PATCH, DELETE, imports getChannel/updateChannel/archiveChannel |
| `src/app/api/messaging/channels/[id]/members/route.ts` | GET + POST + PATCH + DELETE | VERIFIED | 53 lines, exports GET/POST/PATCH/DELETE, includes MuteSchema for PATCH (CHAN-07) |
| `src/app/api/messaging/channels/[id]/messages/route.ts` | GET paginated + POST send | VERIFIED | 45 lines, exports GET/POST, MessagesQuerySchema for cursor params, imports from messageService |
| `src/app/api/messaging/messages/[id]/route.ts` | PATCH edit + DELETE soft-delete | VERIFIED | 36 lines, exports PATCH/DELETE, DELETE checks MESSAGING_MESSAGES_DELETE_ANY via permissions.can() |
| `src/app/api/messaging/dms/route.ts` | POST find-or-create DM | VERIFIED | 15 lines, exports POST, MESSAGING_DMS_SEND permission, imports findOrCreateDM |
| `src/app/api/messaging/search/route.ts` | GET full-text search | VERIFIED | 29 lines, exports GET, imports searchMessages/SearchQuerySchema, parses query params |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| channels/route.ts | channelService.ts | import { getChannels, createChannel, CreateChannelSchema } | WIRED | Lines 6-9: direct named imports, called in GET/POST handlers |
| channels/[id]/route.ts | channelService.ts | import { getChannel, updateChannel, archiveChannel, UpdateChannelSchema } | WIRED | Lines 5-10: direct named imports, called in GET/PATCH/DELETE |
| channels/[id]/members/route.ts | channelService.ts | import { getChannelMembers, addMember, removeMember, AddMemberSchema, RemoveMemberSchema } | WIRED | Lines 6-12: direct named imports, called in GET/POST/DELETE |
| dms/route.ts | channelService.ts | import { findOrCreateDM, FindOrCreateDMSchema } | WIRED | Lines 5-8: direct named imports, called in POST |
| channels/[id]/messages/route.ts | messageService.ts | import { getMessages, sendMessage, SendMessageSchema } | WIRED | Lines 12-16: direct named imports, called in GET/POST |
| messages/[id]/route.ts | messageService.ts | import { editMessage, deleteMessage, EditMessageSchema } | WIRED | Lines 15-18: direct named imports, called in PATCH/DELETE |
| search/route.ts | messageService.ts | import { searchMessages, SearchQuerySchema } | WIRED | Lines 11-14: direct named imports, called in GET |
| channelService.ts | prisma.channel | org-scoped Prisma client | WIRED | db.channel.create/findMany/findUnique/update used throughout |
| messageService.ts | prisma.message | org-scoped Prisma client | WIRED | db.message.create/findUnique/findMany/update used throughout |
| messageService.ts | prisma.messageMention | mention row creation | WIRED | db.messageMention.deleteMany + createMany in parseMentions (lines 219, 291) |
| messageService.ts | rawPrisma.$queryRaw | tsvector search | WIRED | rawPrisma.$queryRaw with Prisma.sql tagged template (lines 406-434) |
| middleware.ts | rawPrisma.organization | messagingEnabled lookup | WIRED | rawPrisma.organization.findUnique with select: { messagingEnabled: true } (line 363) |

### Data-Flow Trace (Level 4)

Not applicable -- these are API route handlers and service functions, not UI components rendering dynamic data. Data flows are verified via key link wiring above.

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running server with authenticated session and seeded data -- routed to human verification)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------ |-------------|--------|----------|
| CHAN-01 | 24-01, 24-03 | Create public channel | SATISFIED | createChannel with type='PUBLIC', POST /channels with CreateChannelSchema |
| CHAN-02 | 24-01, 24-03 | Create private channel | SATISFIED | createChannel supports type='PRIVATE', getChannels filters PRIVATE to members only |
| CHAN-03 | 24-01, 24-03 | Start 1:1 DM | SATISFIED | findOrCreateDM with 1 target -> type='DM', POST /dms route |
| CHAN-04 | 24-01, 24-03 | Start group DM | SATISFIED | findOrCreateDM with 2-7 targets -> type='GROUP_DM', max 8 enforced |
| CHAN-05 | 24-01, 24-03 | Rename/archive/update channels | SATISFIED | updateChannel with owner/admin/MANAGE check, archiveChannel, PATCH/DELETE routes |
| CHAN-06 | 24-01, 24-03 | View/manage member list | SATISFIED | getChannelMembers, addMember, removeMember with permission checks, GET/POST/DELETE members routes |
| CHAN-07 | 24-03 | Mute channel | SATISFIED | PATCH on members route with MuteSchema, sets mutedAt timestamp |
| MSG-01 | 24-02, 24-04 | Send text message | SATISFIED | sendMessage with membership check, POST /channels/[id]/messages |
| MSG-02 | 24-02, 24-04 | Edit own messages | SATISFIED | editMessage checks authorId===userId, sets editedAt, PATCH /messages/[id] |
| MSG-03 | 24-02, 24-04 | Soft-delete own/admin delete any | SATISFIED | deleteMessage with canDeleteAny boolean, route checks MESSAGING_MESSAGES_DELETE_ANY |
| MSG-07 | 24-02, 24-04 | @mention user/channel/here/team | SATISFIED | parseMentions with regex patterns for all 4 mention types, creates MessageMention rows |
| SRCH-01 | 24-02, 24-04 | Search messages across channels | SATISFIED | searchMessages with tsvector, results include channelName/authorName/createdAt, GET /search |
| SRCH-02 | 24-02, 24-04 | Search scoped to org via tsvector | SATISFIED | SQL filters by organizationId, ChannelMember subquery, uses searchVector @@ to_tsquery |

All 13 requirements accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found in any phase files |

No TODO/FIXME/PLACEHOLDER markers, no empty implementations, no hardcoded empty data, no console.log-only handlers found across all 9 files.

### Human Verification Required

### 1. Smoke-test message send and retrieve

**Test:** POST a message to a channel, then GET the channel messages and confirm the message appears
**Expected:** 201 on send with MessageWithAuthor shape; GET returns paginated messages with hasMore/cursor meta
**Why human:** Requires running server with auth token, seeded org, and channel membership

### 2. Smoke-test full-text search

**Test:** Send several messages with known terms, then GET /api/messaging/search?q=term
**Expected:** Results array with channelName, authorName, createdAt; scoped to user's channels only
**Why human:** Requires tsvector index to be populated (Postgres trigger or manual), running server

### 3. Verify messagingEnabled middleware gate

**Test:** Set an org's messagingEnabled to false, then hit any /api/messaging/* endpoint
**Expected:** 403 response with `{ ok: false, error: { code: 'FEATURE_DISABLED' } }`
**Why human:** Requires database state manipulation and running server

### Gaps Summary

No gaps found. All 4 roadmap success criteria verified via code inspection. All 13 requirement IDs are satisfied by substantive, wired implementations. All 9 artifacts exist, are substantive (610 + 456 lines for services, properly structured routes), and are wired via direct imports. The middleware gate is in place at the correct location (after x-org-id is set, before final NextResponse.next()).

Three items routed to human verification: message send/retrieve smoke test, full-text search smoke test, and middleware gate test. These require a running server with seeded data and cannot be verified by code inspection alone.

---

_Verified: 2026-05-07T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
