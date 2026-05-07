# Architecture: Real-Time Messaging Integration

**Project:** Lionheart v4.0 Messaging
**Researched:** 2026-05-07
**Confidence:** HIGH — based on existing codebase patterns + verified Supabase Realtime docs

---

## The Core Problem

Lionheart already uses Supabase for storage and Realtime for event chat and presence (see `src/lib/hooks/useEventChat.ts` and `src/lib/hooks/usePresence.ts`). The messaging module is a scaled-up, org-gated version of the same pattern — not a new technology introduction.

The main architectural questions are:

1. How does the existing custom JWT (HS256, `jose`) authenticate against Supabase Realtime?
2. Which Realtime delivery mode to use (Postgres Changes vs Broadcast)?
3. Where does the messaging UI live inside the existing layout?
4. How do the new Prisma models integrate with the org-scoping extension?

---

## Supabase Realtime Auth Bridge

This is the highest-risk integration point. Here is exactly how it works and what to do.

### The Problem

Supabase Realtime enforces access using RLS policies that read claims from `auth.jwt()` inside Postgres. Lionheart's JWTs are signed with `AUTH_SECRET` (HS256), not Supabase's JWT secret. Supabase Realtime will reject them unless the token either:

- Is signed with the Supabase JWT secret, OR
- Is passed via the `accessToken` option on `createClient`, which then attaches it as Bearer on every Supabase request (including Realtime WebSocket handshake) and bypasses Supabase Auth

### The Solution

Use `createClient` with the `accessToken` option. This is documented for third-party auth providers and works correctly with Realtime:

```typescript
// src/lib/supabase-messaging-client.ts (NEW FILE)
import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null
let _tokenFn: (() => Promise<string | null>) | null = null

export function initMessagingClient(getToken: () => Promise<string | null>) {
  _tokenFn = getToken
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: getToken,
      realtime: { params: { eventsPerSecond: 20 } },
    }
  )
  return _client
}

export function getMessagingClient() {
  return _client
}
```

The `accessToken` option disables `supabase.auth.*` on this client instance entirely. That is fine — Lionheart doesn't use Supabase Auth.

The token getter reads from the `auth-token` cookie (already available client-side as a non-httpOnly readable value — confirm this; if httpOnly, use the `/api/auth/me` pattern instead or expose a short-lived messaging token via a dedicated endpoint).

**JWT claims required for RLS:**

Supabase's Postgres RLS reads claims via `auth.jwt()`. For custom JWTs to work in RLS policies, the JWT must include:
- `role: "authenticated"` — required for RLS policies targeting the `authenticated` role
- `sub` — maps to the user identifier inside Postgres
- `org_id` — custom claim for org-scoping RLS

Lionheart's current JWT payload is `{ userId, organizationId, email }`. For messaging RLS you'll either:

1. Add `role: "authenticated"` and `sub: userId` to the token payload in `signAuthToken()`, OR
2. Write RLS policies that read `auth.jwt() ->> 'userId'` and `auth.jwt() ->> 'organizationId'` directly

Option 2 requires no change to the token shape. Option 1 is cleaner if any Supabase features use `auth.uid()`.

**Recommendation:** Go with Option 2 for now. Add the claims to the Postgres RLS policies using `current_setting('request.jwt.claims', true)::json ->> 'userId'` syntax. Zero risk of breaking existing auth.

---

## Realtime Delivery: Broadcast-from-Database (not Postgres Changes)

There are three Supabase Realtime delivery modes. Here is which one to use and why.

### Why Not Postgres Changes

Postgres Changes runs an RLS SELECT check for every subscribed client on every change. In a channel with 50 members, one new message triggers 50 separate DB authorization queries. At any real scale this kills performance and burns DB connections.

### Why Not Client Broadcast

Client Broadcast (the pattern used in `useEventChat.ts`) requires each sender to explicitly call `channel.send(...)`. That works for event chat where there is one sender. For the messaging module, the server writes the message (for persistence, validation, attachments, mentions) and then needs to notify all subscribers — client broadcast doesn't fit that server-writes pattern well.

### Use Broadcast-from-Database (recommended)

This is the correct pattern for chat at scale. A Postgres trigger on the `Message` table calls `realtime.send(...)` after each INSERT. Supabase Realtime reads the WAL and broadcasts it to all subscribed clients on that channel. No per-subscriber RLS query. Scales to tens of thousands of subscribers.

```sql
-- Postgres trigger (applied via Prisma migration raw SQL)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM realtime.send(
    json_build_object(
      'id',         NEW.id,
      'channelId',  NEW."channelId",
      'orgId',      NEW."organizationId",
      'content',    NEW.content,
      'userId',     NEW."userId",
      'createdAt',  NEW."createdAt"
    ),
    'INSERT',
    'messaging:' || NEW."organizationId" || ':' || NEW."channelId",
    false  -- not private — access controlled at channel subscription level
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_broadcast
  AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
```

The client subscribes to `messaging:{orgId}:{channelId}`. The trigger fires after Prisma creates the message row. No polling needed. Fallback to polling at 10s intervals if Supabase is not configured.

---

## Data Flow: Send a Message

```
User types → POST /api/messaging/channels/{channelId}/messages
  → withAuth (verifies JWT, extracts orgId + userId)
  → assertCan(userId, PERMISSIONS.MESSAGING_SEND)
  → runWithOrgContext(orgId, ...)
  → prisma.message.create(...)           // org-scoped, soft-delete-aware
  → [Postgres trigger fires]
  → realtime.send(payload, channel)      // inside Postgres
  → Supabase Realtime WebSocket
  → Other clients on same channel get payload instantly
  → Sender client gets optimistic update locally (no wait needed)
```

**What the Prisma create also does (within the same transaction):**

1. Creates `MessageMention` rows if content has `@user` references
2. Marks channel `lastMessageAt` (update on `Channel`)
3. Does NOT create notifications — that is a separate async job (see below)

---

## Data Flow: Receive Messages

```
Client mounts MessagingLayout
  → useMessagingClient() initializes Supabase client with token getter
  → Fetch initial messages via GET /api/messaging/channels/{channelId}/messages
  → Subscribe to realtime channel: messaging:{orgId}:{channelId}
  → New message arrives via WebSocket payload
  → React state updated (setMessages(prev => [...prev, incoming]))
  → TanStack Query cache NOT used for live stream (state managed locally in hook)
  → TanStack Query IS used for channel list, member list, unread counts
```

---

## Data Flow: Notifications

Notifications are decoupled from message delivery. A separate background job handles them.

```
Message created (Prisma) →
  [Supabase Postgres trigger broadcasts to Realtime subscribers]
  [API route after create:] await notificationService.queueMessagingNotifications(messageId)
    → read ChannelMember rows for channel
    → skip members with NotificationPreference set to NONE
    → create Notification rows (existing Notification model, already org-scoped)
    → for members not connected (presence check): queue email digest job
    → web push: send via existing push subscription mechanism
```

This keeps message delivery and notification delivery independent. A slow email queue never blocks message writes.

---

## New vs Modified Components

### New Files

**API routes** — all under `src/app/api/messaging/`:
- `channels/route.ts` — list + create channels
- `channels/[channelId]/route.ts` — get/update/delete channel
- `channels/[channelId]/messages/route.ts` — list + send messages
- `channels/[channelId]/messages/[messageId]/route.ts` — edit/delete/react
- `channels/[channelId]/members/route.ts` — add/remove members
- `channels/[channelId]/threads/[threadId]/route.ts` — thread replies
- `dms/route.ts` — create DM or group DM channel
- `search/route.ts` — full-text search (tsvector query)
- `preferences/route.ts` — notification preferences per user

**Services** — `src/lib/services/messaging/`:
- `channelService.ts` — channel CRUD, auto-channel creation, membership
- `messageService.ts` — message CRUD, mention parsing, reaction handling
- `notificationService.ts` — messaging-specific notification dispatch
- `presenceService.ts` — read state tracking, online indicators

**Hooks** — `src/lib/hooks/messaging/`:
- `useMessaging.ts` — top-level hook: client init, channel subscription
- `useChannelMessages.ts` — message list state + realtime updates
- `useChannelList.ts` — TanStack Query for sidebar channel list
- `usePresenceTracker.ts` — who is online in a channel
- `useUnreadCounts.ts` — per-channel unread badge numbers

**Supabase client:**
- `src/lib/supabase-messaging-client.ts` — dedicated Supabase client with `accessToken` option (separate from `supabase-browser.ts` to avoid disrupting existing event chat + presence hooks)

**UI components** — `src/components/messaging/`:
- `MessagingLayout.tsx` — two-panel shell (channel list left, message area right)
- `ChannelList.tsx` — sidebar list with unread badges, grouped by type
- `MessageArea.tsx` — virtual-scrolled message list + composer
- `MessageComposer.tsx` — rich text input, attachments, emoji, @mentions
- `MessageItem.tsx` — single message with reactions, thread count, edit/delete
- `ThreadPanel.tsx` — right-side thread drawer
- `ChannelHeader.tsx` — channel name, members, search, settings
- `MemberPicker.tsx` — people search for adding members / DM creation
- `SearchPanel.tsx` — full-text search UI

**Page:**
- `src/app/messaging/page.tsx` — messaging home (redirects to first unread channel)
- `src/app/messaging/[channelId]/page.tsx` — specific channel view

### Modified Files

**`src/lib/db/index.ts`** — add new messaging models to `orgScopedModels` set:
```typescript
// Messaging module
'Channel', 'ChannelMember', 'Message', 'MessageReaction',
'MessageAttachment', 'MessageMention', 'NotificationPreference',
'PushSubscription',
```

Add soft-delete models: `'Channel', 'Message'`

**`src/lib/permissions.ts`** — add messaging permissions:
```typescript
MESSAGING_READ:    'messaging:read',
MESSAGING_SEND:    'messaging:send',
MESSAGING_MANAGE:  'messaging:manage',   // create/delete channels, kick members
```

**`src/components/sidebar/MainNavContent.tsx`** — add messaging nav item with unread badge, behind `TenantModule` check for `moduleId: 'messaging'`

**`src/components/DashboardLayout.tsx`** — messaging module gate wrapping the nav item; also the global presence WebSocket init lives here (one client for the session, not per-page)

**`prisma/schema.prisma`** — new models (see Prisma Models section below)

**`src/app/api/modules/route.ts`** — no change needed; messaging uses the existing `TenantModule` pattern with `moduleId: 'messaging'`

---

## Prisma Models

All new models follow the existing org-scoped + soft-delete conventions.

```prisma
model Channel {
  id             String        @id @default(cuid())
  organizationId String
  name           String?
  slug           String?
  description    String?
  type           ChannelType   @default(PUBLIC)
  // Context link (auto-channels)
  linkedEntityType String?     // 'ticket' | 'event' | 'school' | 'team' | 'building'
  linkedEntityId   String?
  createdByUserId  String
  lastMessageAt    DateTime?
  deletedAt        DateTime?
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  organization Organization  @relation(...)
  members      ChannelMember[]
  messages     Message[]

  @@unique([organizationId, slug])
  @@index([organizationId])
  @@index([organizationId, type])
}

model ChannelMember {
  id             String   @id @default(cuid())
  channelId      String
  userId         String
  organizationId String
  role           ChannelMemberRole @default(MEMBER)
  lastReadAt     DateTime?
  mutedAt        DateTime?
  joinedAt       DateTime @default(now())

  channel  Channel @relation(...)
  user     User    @relation(...)

  @@unique([channelId, userId])
  @@index([organizationId, userId])
}

model Message {
  id             String   @id @default(cuid())
  organizationId String
  channelId      String
  userId         String
  content        String
  contentSearch  Unsupported("tsvector")?  // populated by Postgres trigger
  parentMessageId String?   // thread parent
  isPinned       Boolean  @default(false)
  editedAt       DateTime?
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  channel     Channel             @relation(...)
  user        User                @relation(...)
  reactions   MessageReaction[]
  attachments MessageAttachment[]
  mentions    MessageMention[]
  thread      Message[]           @relation("thread")
  parent      Message?            @relation("thread", fields: [parentMessageId], ...)

  @@index([organizationId, channelId, createdAt])
  @@index([organizationId, userId])
}
```

`MessageReaction`, `MessageAttachment`, `MessageMention`, `NotificationPreference`, and `PushSubscription` follow the same org-scoped pattern.

**GIN index for full-text search** — add via raw SQL migration:
```sql
CREATE INDEX message_content_search_idx ON "Message" USING GIN ("contentSearch");
```

---

## UI Layout Integration

The messaging module is a first-class section in the sidebar, not a modal or overlay.

```
DashboardLayout
  ├── Sidebar
  │   ├── MainNavContent
  │   │   ├── [existing nav items]
  │   │   └── Messaging (new — with unread badge, behind TenantModule gate)
  └── Main content area
      └── /messaging/[channelId]  ← replaces main content (not a drawer)
          └── MessagingLayout
              ├── ChannelList (left panel ~280px)
              └── MessageArea (right panel — fills remaining space)
                  └── ThreadPanel (slides in from right when thread is open)
```

The messaging area gets a dedicated page layout, similar to how the Calendar page takes over the full content area. It does not share space with other content (unlike the AI chat panel).

The global Supabase client init (with `accessToken`) happens once in `DashboardLayout` via a `useEffect` on mount. All messaging hooks pick up the already-initialized client from the module-level singleton in `supabase-messaging-client.ts`.

---

## Multi-Tenancy Integration

Nothing exotic is needed. Follow the existing pattern exactly.

Every API route:
```typescript
export const POST = withAuth(async ({ orgId, ctx, body }) => {
  await assertCan(ctx.userId, PERMISSIONS.MESSAGING_SEND)
  return await runWithOrgContext(orgId, async () => {
    const message = await prisma.message.create({ data: { ...body, userId: ctx.userId } })
    return NextResponse.json(ok(message), { status: 201 })
  })
}, { schema: CreateMessageSchema })
```

The org-scoped `prisma` client auto-injects `organizationId` on create and filters it on reads. Add `Channel`, `ChannelMember`, `Message`, etc. to `orgScopedModels` in `src/lib/db/index.ts`.

**Important:** The Realtime channel name includes `orgId` as a prefix: `messaging:{orgId}:{channelId}`. This is a defense-in-depth measure — even if Realtime authorization policies were misconfigured, a client from Org A cannot subscribe to Org B's channel name (they would not know the CUID).

---

## Module Gating

Use the existing `TenantModule` system. No new pattern needed.

```typescript
// Check in API routes
const modules = await prisma.tenantModule.findFirst({
  where: { organizationId: orgId, moduleId: 'messaging' }
})
if (!modules) return NextResponse.json(fail('FORBIDDEN', 'Messaging not enabled'), { status: 403 })
```

The UI sidebar item is hidden unless the module record exists. The `ModuleGate` component handles this client-side via the existing `/api/modules` endpoint.

---

## Build Order

Dependencies drive this order. Each phase unblocks the next.

**Phase 1: Schema + Permissions**
Add models to `schema.prisma`, add messaging models to `orgScopedModels`, add `MESSAGING_*` permissions, run `db:push`.
No UI, no Realtime. Pure data foundation.

**Phase 2: Core API Routes**
Channels CRUD + Messages CRUD (no Realtime yet). Use polling fallback everywhere.
Test with smoke tests against live API. This is the stable core that everything else builds on.

**Phase 3: Realtime Bridge**
Create `supabase-messaging-client.ts` with `accessToken` option. Write the Postgres trigger that calls `realtime.send(...)`. Write and validate RLS policies using `auth.jwt()` custom claims.
Verify with a test client that messages arrive over WebSocket.

**Phase 4: Core UI**
`MessagingLayout`, `ChannelList`, `MessageArea`, `MessageComposer`, `MessageItem`. Wire to API routes + Realtime hook. No threads, no reactions, no attachments yet — just send/receive text.

**Phase 5: Sidebar Integration + Module Gate**
Add messaging nav item to `MainNavContent`. Wire up unread count badge. Add `TenantModule` gate. Add messaging page routes.

**Phase 6: Reactions, Threads, Attachments**
Build on top of working foundation. These are additive — no changes to core message flow.

**Phase 7: Presence + Read State**
Online indicators, read receipts, unread badges per channel. Uses same Supabase Presence pattern as existing `usePresence.ts`.

**Phase 8: Auto-Channels + Search**
Ticket/event/school/team auto-channel creation. Full-text search via tsvector. System bot messages.

**Phase 9: Notifications**
Email digest, web push. Builds on existing `Notification` model and email service.

---

## Key Risks and Mitigations

**Risk: httpOnly cookie inaccessible to Supabase client**
The `auth-token` cookie is `httpOnly`, which means JavaScript cannot read it. The `accessToken` callback in `createClient` runs in the browser.

Mitigation: Expose the current token via a lightweight `/api/auth/token` endpoint that returns the bearer token from the cookie to JavaScript. The endpoint uses the existing `getUserContext` pattern and returns just `{ token: string }`. This is standard practice for httpOnly-cookie apps that need to pass tokens to WebSocket or third-party clients.

Alternatively, store a non-sensitive short-lived "messaging token" in `localStorage` (separate from the httpOnly auth token) that the messaging client uses exclusively.

**Risk: Postgres trigger breaks on Supabase plan**
`realtime.send` is a Supabase-specific function. If it is unavailable (e.g., Supabase plan restriction), the trigger will error on every INSERT.

Mitigation: Wrap trigger in exception handler (Supabase docs show this is safe). Fall back to polling at 10-second intervals in the client hook — the same fallback already used in `useEventChat.ts`.

**Risk: RLS policy blocks message delivery**
If the JWT claims don't match what the RLS policy expects, messages will be silently filtered by Realtime.

Mitigation: Test RLS policies explicitly during Phase 3 before building UI. Log policy evaluation failures during dev using `RAISE NOTICE` in the policy function.

**Risk: Channel names collide across orgs**
A malicious client could guess another org's channel CUID.

Mitigation: Prefix channel names with `orgId` as described above, and enforce `ChannelMember` membership check in every API route. Even if someone guesses a channel name, the API will return 403 and the RLS policy will block their data.

---

## Sources

- Supabase JS `accessToken` option: https://github.com/supabase/supabase-js (HIGH confidence)
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization (HIGH confidence)
- Broadcast from Database: https://supabase.com/blog/realtime-broadcast-from-database (HIGH confidence)
- Postgres Changes RLS scaling concern: https://supabase.com/docs/guides/realtime/postgres-changes (HIGH confidence)
- Custom JWT with `realtime.setAuth`: https://github.com/orgs/supabase/discussions/28483 (MEDIUM confidence)
- RLS policy claims pattern: https://queen.raae.codes/2025-05-01-supabase-exchange/ (MEDIUM confidence)
- Existing codebase patterns: `src/lib/hooks/useEventChat.ts`, `src/lib/hooks/usePresence.ts`, `src/lib/supabase-browser.ts` (HIGH confidence — verified in codebase)
