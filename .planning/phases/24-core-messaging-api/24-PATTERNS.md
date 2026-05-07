# Phase 24: Core Messaging API - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/messaging/channels/route.ts` | controller | CRUD | `src/app/api/conversations/route.ts` | exact |
| `src/app/api/messaging/channels/[id]/route.ts` | controller | CRUD | `src/app/api/conversations/[id]/route.ts` | exact |
| `src/app/api/messaging/channels/[id]/members/route.ts` | controller | CRUD | `src/app/api/settings/teams/[id]/route.ts` | role-match |
| `src/app/api/messaging/channels/[id]/messages/route.ts` | controller | request-response | `src/app/api/conversations/[id]/messages/route.ts` | exact |
| `src/app/api/messaging/messages/[id]/route.ts` | controller | CRUD | `src/app/api/settings/teams/[id]/route.ts` | role-match |
| `src/app/api/messaging/dms/route.ts` | controller | request-response | `src/app/api/conversations/route.ts` | role-match |
| `src/app/api/messaging/search/route.ts` | controller | request-response | `src/app/api/conversations/[id]/messages/route.ts` | partial |
| `src/lib/services/channelService.ts` | service | CRUD | `src/lib/services/ticketService.ts` | role-match |
| `src/lib/services/messageService.ts` | service | CRUD | `src/lib/services/eventChatService.ts` | exact |
| `src/middleware.ts` | middleware | request-response | (self — adding messagingEnabled gate) | self-modify |

## Pattern Assignments

### `src/app/api/messaging/channels/route.ts` (controller, CRUD — GET list + POST create)

**Analog:** `src/app/api/conversations/route.ts`

**Imports pattern** (lines 1-12):
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// Service import — will be channelService
```

**GET with query parsing** (lines 14-31):
```typescript
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const query = QuerySchema.parse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  const data = await getChannels(/* ... */)
  return NextResponse.json(ok(data))
})
```

**POST with Zod body schema** (from `src/app/api/settings/users/route.ts` lines 160-335):
```typescript
export const POST = withAuth(async ({ ctx, orgId, body }) => {
  const channel = await channelService.createChannel(body, ctx.userId)
  return NextResponse.json(ok(channel), { status: 201 })
}, { permission: PERMISSIONS.MESSAGING_CHANNELS_CREATE, schema: CreateChannelSchema })
```

---

### `src/app/api/messaging/channels/[id]/route.ts` (controller, CRUD — GET/PATCH/DELETE)

**Analog:** `src/app/api/conversations/[id]/route.ts` + `src/app/api/settings/teams/[id]/route.ts`

**GET single with params typing** (conversations/[id]/route.ts lines 12-18):
```typescript
export const GET = withAuth(async ({ orgId, params }) => {
  const conversation = await getConversation(params.id, orgId)
  if (!conversation) {
    return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
  }
  return NextResponse.json(ok(conversation))
})
```

**PATCH with typed body + params** (teams/[id]/route.ts lines 59-109):
```typescript
export const PATCH = withAuth<z.infer<typeof UpdateTeamSchema>, { id: string }>(async ({ orgId, ctx, body, params, req }) => {
  const team = await prisma.team.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true, slug: true },
  })
  if (!team) {
    return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
  }
  const updated = await prisma.team.update({
    where: { id: params.id },
    data: { /* ... */ },
  })
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.TEAMS_UPDATE, schema: UpdateTeamSchema })
```

**DELETE (archive pattern)** (conversations/[id]/route.ts lines 20-38):
```typescript
export const DELETE = withAuth(async ({ orgId, ctx, params }) => {
  // For channels: archiveChannel sets archivedAt instead of real delete
  await channelService.archiveChannel(params.id, ctx.userId)
  return NextResponse.json(ok({ archived: true }))
}, { permission: PERMISSIONS.MESSAGING_CHANNELS_MANAGE })
```

---

### `src/app/api/messaging/channels/[id]/members/route.ts` (controller, CRUD — GET/POST/DELETE)

**Analog:** `src/app/api/settings/teams/[id]/route.ts` (junction table member management)

**Junction table pattern** (teams/[id]/route.ts lines 138-214):
```typescript
// List members — findMany on junction + user include
const members = await prisma.channelMember.findMany({
  where: { channelId: params.id },
  include: {
    user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  },
})

// Add member — upsert on junction table with unique constraint
await prisma.channelMember.upsert({
  where: { channelId_userId: { channelId: params.id, userId: body.userId } },
  create: { channelId: params.id, userId: body.userId, role: 'member' },
  update: {},
})

// Remove member — delete junction row
// Schema: @@unique([channelId, userId])
await prisma.channelMember.delete({
  where: { channelId_userId: { channelId: params.id, userId: body.userId } },
})
```

---

### `src/app/api/messaging/channels/[id]/messages/route.ts` (controller, request-response — GET paginated + POST send)

**Analog:** `src/app/api/conversations/[id]/messages/route.ts`

**GET with cursor-based pagination** (conversations/[id]/messages/route.ts lines 14-37):
```typescript
// NOTE: Conversations route uses offset pagination. Messaging needs cursor-based.
// Cursor pattern (adapt from this base):
const QuerySchema = z.object({
  before: z.string().optional(),       // cursor — message ID
  after: z.string().optional(),        // cursor — message ID
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withAuth(async ({ orgId, params, searchParams }) => {
  const query = QuerySchema.parse({
    before: searchParams.get('before') ?? undefined,
    after: searchParams.get('after') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })
  // Verify channel membership before returning messages
  const messages = await messageService.getMessages(params.id, ctx.userId, query)
  return NextResponse.json(ok(messages))
})
```

**POST message** (from eventChatService.ts pattern, lines 47-67):
```typescript
export const POST = withAuth(async ({ orgId, ctx, params, body }) => {
  const message = await messageService.sendMessage(params.id, ctx.userId, body)
  return NextResponse.json(ok(message), { status: 201 })
}, { schema: SendMessageSchema })
```

---

### `src/app/api/messaging/messages/[id]/route.ts` (controller, CRUD — PATCH edit + DELETE soft-delete)

**Analog:** `src/app/api/settings/teams/[id]/route.ts`

**PATCH own-message-only pattern:**
```typescript
export const PATCH = withAuth<z.infer<typeof EditMessageSchema>, { id: string }>(async ({ ctx, params, body }) => {
  // messageService.editMessage checks authorId === ctx.userId internally
  const updated = await messageService.editMessage(params.id, ctx.userId, body)
  return NextResponse.json(ok(updated))
}, { schema: EditMessageSchema })
```

**DELETE with permission-gated "delete any":**
```typescript
export const DELETE = withAuth<unknown, { id: string }>(async ({ ctx, params, permissions }) => {
  // Own message: always allowed. Others' messages: require MESSAGING_MESSAGES_DELETE_ANY
  const canDeleteAny = await permissions.can(PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY)
  await messageService.deleteMessage(params.id, ctx.userId, canDeleteAny)
  return NextResponse.json(ok({ deleted: true }))
})
```

---

### `src/app/api/messaging/dms/route.ts` (controller, request-response — POST find-or-create)

**Analog:** `src/app/api/conversations/route.ts`

**Find-or-create idempotent pattern:**
```typescript
const FindOrCreateDMSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(7),
  // max 7 other users + caller = 8 total for group DM
})

export const POST = withAuth(async ({ ctx, body }) => {
  const channel = await channelService.findOrCreateDM(ctx.userId, body.userIds)
  return NextResponse.json(ok(channel), { status: 200 }) // 200, not 201 — may be existing
}, { permission: PERMISSIONS.MESSAGING_DMS_SEND, schema: FindOrCreateDMSchema })
```

---

### `src/app/api/messaging/search/route.ts` (controller, request-response — GET search)

**Analog:** `src/app/api/conversations/[id]/messages/route.ts` (query params pattern)

**Search route pattern:**
```typescript
const SearchSchema = z.object({
  q: z.string().min(1).max(500),
  channelId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const query = SearchSchema.parse({
    q: searchParams.get('q') ?? '',
    channelId: searchParams.get('channelId') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  })
  const results = await messageService.searchMessages(ctx.userId, query)
  return NextResponse.json(ok(results))
})
```

---

### `src/lib/services/channelService.ts` (service, CRUD)

**Analog:** `src/lib/services/ticketService.ts`

**Imports pattern** (ticketService.ts lines 1-6):
```typescript
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { can } from '@/lib/auth/permissions'
```

**Zod schema at top of service** (ticketService.ts lines 10-41):
```typescript
export const CreateChannelSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  type: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  description: z.string().max(500).trim().optional().nullable(),
})
```

**Service function signature** (ticketService.ts lines 90-157):
```typescript
export async function createChannel(
  input: z.infer<typeof CreateChannelSchema>,
  userId: string
): Promise<Channel> {
  // Slug generation from name
  // prisma.channel.create with data + include
  // Auto-add creator as ChannelMember with role='owner'
  // Return shaped result
}
```

**List with access control** (ticketService.ts lines 90-157):
```typescript
export async function getChannels(userId: string): Promise<Channel[]> {
  // Public channels: visible to all org members
  // Private channels: only if user is a member
  // DM/GROUP_DM: only if user is a member
  const canManage = await can(userId, PERMISSIONS.MESSAGING_CHANNELS_MANAGE)
  // If canManage, show all non-DM channels; else filter by membership for PRIVATE
}
```

---

### `src/lib/services/messageService.ts` (service, CRUD + search)

**Analog:** `src/lib/services/eventChatService.ts`

**Imports + interface pattern** (eventChatService.ts lines 1-18):
```typescript
import { prisma, type OrgPrismaClient } from '@/lib/db'

export interface MessageWithAuthor {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  editedAt: string | null
  createdAt: string
}
```

**Shape function pattern** (eventChatService.ts lines 70-90):
```typescript
function shapeMessage(row: Record<string, unknown>): MessageWithAuthor {
  const author = row.author as {
    id: string
    firstName?: string | null
    lastName?: string | null
    avatar?: string | null
  } | null
  return {
    id: row.id as string,
    channelId: row.channelId as string,
    authorId: author?.id ?? (row.authorId as string),
    authorName: author
      ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || 'Unknown'
      : 'Unknown',
    authorAvatar: author?.avatar ?? null,
    content: row.content as string,
    editedAt: row.editedAt ? (row.editedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }
}
```

**Create message with include** (eventChatService.ts lines 47-67):
```typescript
export async function sendMessage(
  channelId: string,
  userId: string,
  content: string,
): Promise<MessageWithAuthor> {
  const db = prisma as unknown as OrgPrismaClient
  const row = await db.message.create({
    data: { channelId, authorId: userId, content },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  })
  // After create: parseMentions(content, channelId) to create MessageMention rows
  return shapeMessage(row)
}
```

**Cursor-based pagination pattern** (new — no exact analog, build from Prisma docs):
```typescript
export async function getMessages(
  channelId: string,
  userId: string,
  opts: { before?: string; after?: string; limit: number }
) {
  // Verify user is member of channel
  const cursor = opts.before ?? opts.after
  const direction = opts.before ? 'desc' : 'asc'
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
      ...(cursor ? { createdAt: { [opts.before ? 'lt' : 'gt']: /* cursor's createdAt */ } } : {}),
    },
    orderBy: { createdAt: direction },
    take: opts.limit + 1, // +1 to detect hasMore
    include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
  })
  const hasMore = messages.length > opts.limit
  if (hasMore) messages.pop()
  if (opts.before) messages.reverse() // Restore chronological order
  return { messages: messages.map(shapeMessage), hasMore, cursor: messages.at(-1)?.id ?? null }
}
```

---

### `src/middleware.ts` (middleware — add messagingEnabled gate)

**Self-modify: add feature gate after auth verification, before route handler runs.**

**Insertion point** — after line 266 (`isPublicPath` early return) and before the CSRF block. The pattern should mirror the existing authenticated-path flow: read the JWT claims, then check the org's `messagingEnabled` field.

**Recommended approach** (lines 267-268 area):
```typescript
// ─── Messaging Feature Gate ──────────────────────────────────────
// Block /api/messaging/* when org hasn't enabled messaging
if (pathname.startsWith('/api/messaging/')) {
  // messagingEnabled check happens inside withAuth or as a lightweight
  // DB lookup. Since middleware runs before route handlers and we
  // already have the org JWT claims at this point, the simplest approach
  // is to add a single DB lookup here. Alternatively, cache on the JWT
  // or use a lightweight in-memory cache keyed by orgId.
}
```

**Note:** The org `messagingEnabled` field exists on `Organization` (schema.prisma line 46). The middleware currently does NOT do DB lookups — it only verifies the JWT. Adding a DB lookup here would be a new pattern. Two options:

1. **Middleware DB lookup** (simple, one query per messaging request)
2. **withAuth-level check** (add a `featureGate` option to withAuth, check inside `runWithOrgContext`)

Option 2 is more consistent with the current architecture where middleware only does JWT verification, and business logic lives in route handlers.

---

## Shared Patterns

### withAuth Wrapper
**Source:** `src/lib/api/with-auth.ts` (full file, 387 lines)
**Apply to:** All 7 route files

Every messaging route uses `withAuth()`. It handles:
- Org context (`runWithOrgContext`)
- Auth (`getUserContext`)
- Permission checks (`assertCan` / `canAny`)
- Zod body parsing via `schema` option
- Error classification (permission, not-found, conflict, validation, Prisma errors)

```typescript
// Simple GET — no permission, no body
export const GET = withAuth(async ({ ctx, orgId, searchParams }) => { /* ... */ })

// POST with permission + schema
export const POST = withAuth(async ({ ctx, orgId, body }) => { /* ... */ },
  { permission: PERMISSIONS.MESSAGING_CHANNELS_CREATE, schema: CreateChannelSchema })

// Dynamic route with typed params
export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => { /* ... */ })

// Multiple permissions (any)
export const DELETE = withAuth(async ({ ctx, params, permissions }) => {
  const canDeleteAny = await permissions.can(PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY)
  // ...
})
```

### Response Envelope
**Source:** `src/lib/api-response.ts`
**Apply to:** All route files

```typescript
import { ok, fail } from '@/lib/api-response'

return NextResponse.json(ok(data))                              // success
return NextResponse.json(ok(data, { total, hasMore, cursor }))  // success + meta
return NextResponse.json(ok(item), { status: 201 })             // created
return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
```

### Permission Constants
**Source:** `src/lib/permissions.ts` (lines 261-265)
**Apply to:** All route files that check permissions

```typescript
PERMISSIONS.MESSAGING_CHANNELS_CREATE     // 'channels:create'
PERMISSIONS.MESSAGING_CHANNELS_MANAGE     // 'channels:manage'
PERMISSIONS.MESSAGING_CHANNELS_MODERATE   // 'channels:moderate'
PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY // 'messages:delete:any'
PERMISSIONS.MESSAGING_DMS_SEND            // 'dms:send'
```

### Org-Scoped Prisma
**Source:** `src/lib/db/index.ts`
**Apply to:** Both service files

```typescript
import { prisma, type OrgPrismaClient } from '@/lib/db'

// Inside service functions (already within runWithOrgContext from withAuth):
const db = prisma as unknown as OrgPrismaClient
const channel = await db.channel.create({ ... })
```

### Slug Generation
**Source:** `src/app/api/settings/teams/[id]/route.ts` (lines 30-38)
**Apply to:** `channelService.ts` for channel slug generation

```typescript
function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (search — `searchMessages`) | service function | full-text search | No existing tsvector/GIN search in service layer. Uses raw SQL via `prisma.$queryRaw` against `searchVector` column. Build from Prisma raw query docs + Phase 23 schema. |
| (cursor-based pagination) | utility pattern | request-response | Existing pagination is offset-based (`src/lib/pagination.ts`). Cursor-based is new. Pattern outlined above in messageService section. |
| (`parseMentions`) | service function | transform | No existing @mention parsing. New utility that regex-extracts `@user`, `@channel`, `@here`, `@team` from message content and creates `MessageMention` rows. |

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/services/`, `src/lib/`, `src/middleware.ts`
**Files scanned:** ~25 candidate files
**Pattern extraction date:** 2026-05-07
