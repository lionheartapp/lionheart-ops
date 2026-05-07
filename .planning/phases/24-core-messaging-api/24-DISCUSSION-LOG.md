# Phase 24: Core Messaging API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 24-core-messaging-api
**Areas discussed:** API route structure, Channel creation and DM flow, Message operations and permissions, Search approach

---

## API Route Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Nested under /api/messaging | All routes under one tree, easy to gate with messagingEnabled | ✓ |
| Flat /api/channels + /api/messages | Separate top-level routes matching existing pattern | |

**User's choice:** Nested under /api/messaging
**Notes:** Enables single middleware gate for messagingEnabled

---

### messagingEnabled Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware check on /api/messaging/* | Single check in middleware.ts, no per-route boilerplate | ✓ |
| Per-route check via withAuth option | featureGate option on withAuth, more flexible but repetitive | |

**User's choice:** Middleware check

---

### Service Files

| Option | Description | Selected |
|--------|-------------|----------|
| Two services | channelService.ts + messageService.ts | ✓ |
| One messagingService.ts | Everything in one file | |
| Three+ services | Fine-grained split | |

**User's choice:** Two services

---

## Channel Creation and DM Flow

### Auto-join on Create

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-join as owner | Creator immediately added as ChannelMember with role='owner' | ✓ |
| Create only, join separately | Channel created but creator must explicitly join | |

**User's choice:** Auto-join as owner

---

### DM Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Find-or-create | Return existing DM if same users, otherwise create | ✓ |
| Always create new | Fresh channel every time | |

**User's choice:** Find-or-create

---

### Group DM Limit

| Option | Description | Selected |
|--------|-------------|----------|
| Max 8 members | Manageable for school staff, larger groups use channels | ✓ |
| Max 20 members | More generous, covers departments | |
| No limit | Unlimited, risk of de facto channels | |

**User's choice:** Max 8

---

## Message Operations and Permissions

### @Mention Parsing

| Option | Description | Selected |
|--------|-------------|----------|
| Parse on send, store in MessageMention | Server extracts mentions on POST, creates rows | ✓ |
| Client sends structured mentions | Client sends mention data alongside content | |

**User's choice:** Parse on send

---

### Message Deletion Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-tier roles only | messages:delete:any for admin/head-of-schools/principal | ✓ |
| Channel owner/moderator too | channels:moderate also allows deletion | |

**User's choice:** Admin-tier only

---

### Message Pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-based with before/after | ?before=msgId&limit=50, matches existing pattern | ✓ |
| Offset-based (limit/offset) | Simpler but less efficient for real-time | |

**User's choice:** Cursor-based

---

## Search Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated search endpoint | GET /api/messaging/search with tsvector GIN index | ✓ |
| Search as channel messages filter | ?q= param on existing messages endpoint, single-channel only | |

**User's choice:** Dedicated endpoint

---

## Claude's Discretion

- Zod validation schemas, Prisma query shapes, error messages, slug generation, DM deduplication strategy

## Deferred Ideas

None
