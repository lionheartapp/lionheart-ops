# Phase 23: Schema, Permissions, and RLS Foundation - Research

**Researched:** 2026-05-07
**Domain:** Prisma schema design, Supabase RLS, PostgreSQL triggers, permission seeding
**Confidence:** HIGH

## Summary

This phase adds 8 Prisma models, extends the org-scoped client, seeds 6 messaging permissions into DEFAULT_ROLES, adds `messagingEnabled` to Organization, and writes Supabase RLS policies + Postgres triggers for unread counters and full-text search. Every pattern in this phase has a working precedent in the existing codebase — it is strictly additive.

The one non-obvious piece is RLS. The project uses a custom HS256 JWT signed with `AUTH_SECRET`, which is separate from the Supabase JWT secret. Supabase RLS policies run inside PostgREST and evaluate claims from the token the Supabase client presents. For RLS to work, the Supabase client must present a token signed with the **Supabase JWT secret** (not `AUTH_SECRET`). This is exactly what RT-04 requires: a server-side `/api/realtime/token` endpoint that exchanges the app JWT for a short-lived Supabase-signed token containing `{ userId, organizationId, role: 'authenticated' }`. Phase 23 only sets up the schema and RLS policies — the token endpoint itself is Phase 25. However, the RLS policies need to be written to consume the claims that endpoint will produce, so the claim names must be decided now.

**Primary recommendation:** Write RLS policies that read `(current_setting('request.jwt.claims', true)::jsonb ->> 'organizationId')` for org isolation, and join against the `ChannelMember` table for channel membership. Use `auth.uid()` (mapped to userId claim) for user identity.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema models (8 Prisma models) | Database / Storage | — | Pure data layer; no API or UI in this phase |
| Org-scoped client registration | API / Backend | — | db/index.ts extension runs server-side only |
| RLS policies | Database / Storage | — | Postgres-layer enforcement; evaluated by PostgREST and Realtime |
| Permission seeding | API / Backend | Database | Constants in permissions.ts; written to DB via seedOrgDefaults |
| messagingEnabled flag | Database / Storage | API / Backend | Schema field; gated in route handlers and UI in later phases |
| Postgres triggers (unread, tsvector) | Database / Storage | — | Pure database automation; no app code needed |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 6 permissions: channels:create, channels:manage, channels:moderate, messages:delete:any, dms:send, integrations:manage
- D-02: Open by default — all roles get channels:create and dms:send. super-admin and admin get channels:moderate, messages:delete:any, integrations:manage. Viewers get read-only (no create/send).
- D-03: Both Prisma org-scoped extension AND RLS policies (belt and suspenders)
- D-04: RLS checks org isolation AND channel membership
- D-05: messagingEnabled hidden completely when off
- D-06: Default value tied to billing plan — free/trial = false, paid = true
- D-07: DMs are channels with type field (PUBLIC, PRIVATE, DM, GROUP_DM)
- D-08: Thread replies via parentId on Message
- D-09: Per-user reaction rows (MessageReaction table)
- D-10: Denormalized unread counter on ChannelMember via database trigger

### Claude's Discretion
- Exact RLS policy SQL syntax and trigger implementation details
- Column types and index strategy beyond tsvector + GIN
- Migration file structure and ordering
- How messagingEnabled default interacts with trial/billing code

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | All 8 messaging models exist as org-scoped Prisma models with soft-delete | Prisma schema patterns from existing models; orgScopedModels + softDeleteModels Sets in db/index.ts |
| SCHEMA-02 | RLS policies on all messaging tables enforce org isolation via custom JWT claims, tested with two different org tokens | Token exchange pattern required; RLS uses organizationId from Supabase-signed JWT claims |
| SCHEMA-03 | 6 messaging permissions seeded into default roles | PERMISSIONS object + DEFAULT_ROLES pattern in permissions.ts; syncRolePermissions() handles existing orgs |
| SCHEMA-04 | Organization model has messagingEnabled boolean flag | Follows aiEnabled pattern in schema; default false for trial, true for paid |
| SCHEMA-05 | Denormalized unread count on ChannelMember maintained by database trigger | PostgreSQL trigger on Message INSERT/DELETE; decrements on lastReadAt update |
| SCHEMA-06 | Full-text search tsvector column on Message with GIN index, populated via Postgres trigger | to_tsvector() trigger + CREATE INDEX USING GIN; standard Postgres FTS pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | v5.22 (existing) | ORM + schema | Already in use; no version change |
| PostgreSQL | 15+ via Supabase | Database + triggers + RLS | Existing infrastructure |
| jose | existing | JWT signing for token exchange | Already used in auth.ts |

### No New Packages Required
[VERIFIED: codebase grep] This phase is entirely schema + config changes. All tools are already installed.

**Version verification:** No new packages. Prisma v5.22 is confirmed in CLAUDE.md.

## Architecture Patterns

### System Architecture Diagram

```
[permissions.ts] ──constants──► [db/index.ts orgScopedModels Set]
      │                                │
      ▼                                ▼
[DEFAULT_ROLES]              [Prisma Client Extension]
      │                         auto-inject orgId on create
      ▼                         auto-filter on reads
[seedOrgDefaults()]
[syncRolePermissions()]  ──writes──► [PostgreSQL]
                                          │
                              ┌───────────┼───────────────┐
                              ▼           ▼               ▼
                         [RLS policies] [Triggers]   [Messaging tables]
                         (org + member  (unread,     Channel, Message,
                          isolation)     tsvector)    ChannelMember, etc.)
```

### Recommended Project Structure
```
prisma/
  schema.prisma              # 8 new models appended
  migrations/
    YYYYMMDD_messaging_schema/migration.sql   # models + RLS + triggers

src/lib/
  db/index.ts               # add 8 model names to orgScopedModels and softDeleteModels
  permissions.ts            # add MESSAGING_* constants + update DEFAULT_ROLES
  services/
    organizationRegistrationService.ts  # no change needed — syncRolePermissions() picks up new perms automatically
```

### Pattern 1: Adding Prisma Models (Org-Scoped + Soft-Delete)
**What:** New models follow existing schema conventions.
**When to use:** Every messaging model that is org-owned.
**Example:**
```prisma
// Source: prisma/schema.prisma — existing models follow this pattern
model Channel {
  id             String      @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  slug           String
  type           ChannelType @default(PUBLIC)
  description    String?
  archivedAt     DateTime?
  deletedAt      DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  createdById    String
  createdBy      User        @relation("ChannelCreator", fields: [createdById], references: [id])
  members        ChannelMember[]
  messages       Message[]

  @@unique([organizationId, slug])
  @@index([organizationId])
}
```

### Pattern 2: Registering in orgScopedModels
**What:** Two Set additions per model.
**Example:**
```typescript
// Source: src/lib/db/index.ts — existing pattern
const orgScopedModels = new Set([
  // ... existing models ...
  // Phase 23: Messaging module
  'Channel',
  'ChannelMember',
  'Message',
  'MessageReaction',
  'MessageAttachment',
  'MessageMention',
  'NotificationPreference',
  'PushSubscription',
])

const softDeleteModels = new Set([
  // ... existing models ...
  // Phase 23: Messaging module (soft-delete these three)
  'Channel',
  'Message',
  // Note: ChannelMember is a junction row — hard delete is fine when removed
])
```

### Pattern 3: Adding Permission Constants
**What:** Add to PERMISSIONS object and map to roles.
**Example:**
```typescript
// Source: src/lib/permissions.ts — existing pattern
export const PERMISSIONS = {
  // ... existing ...

  // Messaging — Phase 23
  MESSAGING_CHANNELS_CREATE:   'channels:create',
  MESSAGING_CHANNELS_MANAGE:   'channels:manage',
  MESSAGING_CHANNELS_MODERATE: 'channels:moderate',
  MESSAGING_MESSAGES_DELETE_ANY: 'messages:delete:any',
  MESSAGING_DMS_SEND:          'dms:send',
  MESSAGING_INTEGRATIONS_MANAGE: 'integrations:manage',  // NOTE: 'integrations:manage' already exists as INTEGRATIONS_MANAGE
} as const
```

**Naming collision note:** `INTEGRATIONS_MANAGE = 'integrations:manage'` already exists in PERMISSIONS for Phase 22 integrations. The messaging `integrations:manage` permission (D-01) is the same string. The planner must decide: reuse `PERMISSIONS.INTEGRATIONS_MANAGE` as-is, or add a messaging-specific alias that maps to the same string. Reusing is simpler and idempotent.

### Pattern 4: RLS Policy SQL
**What:** Enforce org isolation + channel membership at the database layer.
**When to use:** All messaging tables must have RLS enabled.

```sql
-- Source: Supabase Realtime Authorization docs + custom JWT discussion #28483
-- Assumes: Supabase client is called with accessToken() returning a Supabase-signed JWT
-- containing { userId, organizationId, role: 'authenticated' }

-- Helper: extract organizationId from JWT claims
-- (The token endpoint minted in Phase 25 puts organizationId in the payload)
CREATE OR REPLACE FUNCTION messaging_org_id() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'organizationId'
$$;

CREATE OR REPLACE FUNCTION messaging_user_id() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'userId'
$$;

-- Enable RLS on all messaging tables
ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
-- ... all 8 tables ...

-- Channel: read if org matches AND user is a member
CREATE POLICY "channel_read" ON "Channel"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "ChannelMember"
      WHERE "ChannelMember"."channelId" = "Channel"."id"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

-- Message: read if org matches AND user is a member of the channel
CREATE POLICY "message_read" ON "Message"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "ChannelMember"
      WHERE "ChannelMember"."channelId" = "Message"."channelId"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );
```

**Critical: The `role: 'authenticated'` claim in the JWT payload** is what PostgREST uses to route to the `authenticated` Postgres role. Without it, RLS policies targeting `TO authenticated` will not fire.

### Pattern 5: Unread Counter Trigger
**What:** Postgres trigger fires on Message INSERT, increments unread count on ChannelMember rows for all members except the sender.
**Example:**
```sql
-- Source: [ASSUMED] — standard Postgres trigger pattern
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "ChannelMember"
  SET "unreadCount" = "unreadCount" + 1
  WHERE "channelId" = NEW."channelId"
    AND "userId" != NEW."authorId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_increment_unread
  AFTER INSERT ON "Message"
  FOR EACH ROW
  WHEN (NEW."deletedAt" IS NULL)
  EXECUTE FUNCTION increment_unread_count();
```

Decrementing/resetting on read (when `lastReadAt` updates) requires a separate trigger or application logic — this phase only covers the increment side as specified by SCHEMA-05.

### Pattern 6: tsvector Full-Text Search Trigger
**What:** Postgres trigger populates a generated tsvector column on Message.
**Example:**
```sql
-- Source: [ASSUMED] — standard Postgres FTS pattern
ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector;
CREATE INDEX "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");

CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', COALESCE(NEW."content", ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_search_vector_update
  BEFORE INSERT OR UPDATE ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION update_message_search_vector();
```

Note: The `tsvector` column is not declared in the Prisma schema with a Prisma type — declare it as `Unsupported("tsvector")?` in schema.prisma so Prisma does not attempt to manage it as a typed field. The GIN index is created in the migration SQL, not via `@@index` in schema.

### Anti-Patterns to Avoid
- **Putting tsvector in orgScopedModels:** Message is already there; the tsvector column is just a column on Message, not a separate model.
- **Using `rawPrisma.$transaction` for RLS testing:** Test RLS by connecting with two different Supabase clients (different JWT tokens), not Prisma transactions.
- **Storing userId as `@relation` only:** Each messaging model that needs to check user identity in RLS policies should store `userId` as a plain `String` column too, so RLS can compare it without a JOIN.
- **Forgetting `deletedAt: null` in ChannelMember policy:** If ChannelMember has no soft delete, the membership check in RLS is simpler. Don't add soft delete to models that don't need it.
- **Using `integrations:manage` as a new permission:** This string is already used by Phase 22 (INTEGRATIONS_MANAGE). Reuse the existing constant rather than creating a duplicate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unread count aggregation | COUNT(*) query on every sidebar render | Trigger-maintained `unreadCount` on ChannelMember | COUNT(*) at scale causes full table scans; denormalized counter is O(1) |
| Full-text search | ILIKE queries | tsvector + GIN index | ILIKE is O(n) with no index; tsvector GIN is logarithmic and language-aware |
| JWT claim extraction | Custom Postgres function from scratch | `current_setting('request.jwt.claims', true)::jsonb` | Built-in Postgres; no extra dependencies |
| Org-scoping in routes | Manual `WHERE organizationId = ?` | orgScopedPrisma extension (already exists) | Extension auto-injects on every operation; manual approach is error-prone |
| Permission seeding | Ad-hoc SQL inserts | Add to PERMISSIONS + DEFAULT_ROLES; call syncRolePermissions() | Existing orgs will automatically receive new permissions |

**Key insight:** Everything complex in this phase has prior art — either in the existing codebase (org-scoped extension, seedOrgDefaults) or as standard Postgres functionality (tsvector, triggers, RLS). The risk is not in the patterns; it's in the correctness of the JWT claim names used in RLS policies, since those must match what the Phase 25 token endpoint produces.

## Common Pitfalls

### Pitfall 1: JWT Secret Mismatch for RLS
**What goes wrong:** RLS policies silently reject all requests, or always pass (if policies are written incorrectly).
**Why it happens:** The app JWT uses `AUTH_SECRET`; Supabase PostgREST uses the Supabase project's JWT secret. If the Supabase client sends the app JWT directly, PostgREST will reject or mis-parse it.
**How to avoid:** Phase 25 creates a `/api/realtime/token` endpoint that verifies the app JWT and re-signs with the Supabase JWT secret plus `{ role: 'authenticated', userId, organizationId }`. The RLS policies written in Phase 23 must use claim names that match what this endpoint will produce. Lock those names now: `userId` and `organizationId` (camelCase, matching the app JWT payload).
**Warning signs:** All RLS policies return empty result sets; `messaging_org_id()` function returns NULL.

### Pitfall 2: `$transaction` with Org-Scoped Prisma Client
**What goes wrong:** Interactive transactions on the extended `prisma` client lose org-scoping inside the callback.
**Why it happens:** The Prisma Client Extension doesn't propagate through the `tx` proxy in interactive transactions.
**How to avoid:** Use `rawPrisma.$transaction([...])` for batch operations, or sequential `await` calls inside `runWithOrgContext`. CLAUDE.md documents this.
**Warning signs:** Queries inside `$transaction` return data from other orgs.

### Pitfall 3: Prisma Doesn't Know About tsvector
**What goes wrong:** `npx prisma generate` or migration fails because `tsvector` is not a Prisma scalar type.
**Why it happens:** Prisma doesn't natively support PostgreSQL-specific column types.
**How to avoid:** Declare the column in schema.prisma as `searchVector Unsupported("tsvector")?`. The GIN index goes in the migration SQL file as a raw `CREATE INDEX` statement, not as `@@index` in the schema.
**Warning signs:** Prisma generate throws "unknown type" or migration fails.

### Pitfall 4: syncRolePermissions() Must Be Called for Existing Orgs
**What goes wrong:** New messaging permissions exist in DEFAULT_ROLES, but existing orgs seeded before Phase 23 have no RolePermission rows for them.
**Why it happens:** seedOrgDefaults only runs at org creation time.
**How to avoid:** After deploying the permissions change, run `syncRolePermissions(orgId)` for each existing org. This is already built — see `organizationRegistrationService.ts`. The planner should include a migration task that calls this for all orgs.
**Warning signs:** New orgs get the permissions; existing orgs get 403 errors on messaging routes.

### Pitfall 5: RLS Policies on Junction Tables
**What goes wrong:** ChannelMember RLS policy creates a circular dependency — the Message policy queries ChannelMember, but ChannelMember also has an RLS policy.
**Why it happens:** Postgres evaluates RLS on every table access, including inside policy subqueries.
**How to avoid:** Use `SECURITY DEFINER` for the `messaging_org_id()` and `messaging_user_id()` helper functions. Alternatively, set ChannelMember's RLS to use a simpler org-only check, and rely on the Message policy for the membership check.
**Warning signs:** Infinite recursion error from Postgres.

### Pitfall 6: Soft-Delete Scope for ChannelMember
**What goes wrong:** Removed channel members still appear in membership checks.
**Why it happens:** If ChannelMember has no soft-delete, a removed member's row is hard-deleted and correctly excluded. If you accidentally add soft-delete, the RLS subquery must add `AND "deletedAt" IS NULL` — easy to forget.
**How to avoid:** Do NOT add ChannelMember to softDeleteModels. Hard-delete is correct for membership rows.
**Warning signs:** Removed users can still read messages.

## Code Examples

### 8 Messaging Models — Field Reference

The exact field list needed for SCHEMA-01:

```prisma
// Source: REQUIREMENTS.md SCHEMA-01 + D-07/D-08/D-09/D-10 decisions

enum ChannelType {
  PUBLIC
  PRIVATE
  DM
  GROUP_DM
}

model Channel {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(...)
  name           String
  slug           String
  type           ChannelType  @default(PUBLIC)
  description    String?
  topic          String?
  archivedAt     DateTime?
  deletedAt      DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  createdById    String
  members        ChannelMember[]
  messages       Message[]
  @@unique([organizationId, slug])
  @@index([organizationId])
}

model ChannelMember {
  id            String   @id @default(cuid())
  organizationId String
  channelId     String
  channel       Channel  @relation(...)
  userId        String
  user          User     @relation(...)
  role          String   @default("member")  // "owner" | "admin" | "member"
  unreadCount   Int      @default(0)          // SCHEMA-05: maintained by trigger
  lastReadAt    DateTime?
  mutedAt       DateTime?
  createdAt     DateTime @default(now())
  @@unique([channelId, userId])
  @@index([organizationId])
  @@index([userId])
}

model Message {
  id             String    @id @default(cuid())
  organizationId String
  organization   Organization @relation(...)
  channelId      String
  channel        Channel   @relation(...)
  authorId       String
  author         User      @relation("MessageAuthor", ...)
  content        String
  // searchVector tsvector — declared as Unsupported("tsvector")? in schema
  searchVector   Unsupported("tsvector")?   // SCHEMA-06: populated by trigger
  parentId       String?   // D-08: thread reply FK
  parent         Message?  @relation("ThreadReplies", fields: [parentId], references: [id])
  replies        Message[] @relation("ThreadReplies")
  replyCount     Int       @default(0)  // denormalized
  editedAt       DateTime?
  pinnedAt       DateTime?
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  reactions      MessageReaction[]
  attachments    MessageAttachment[]
  mentions       MessageMention[]
  @@index([organizationId])
  @@index([channelId])
}

model MessageReaction {
  id             String   @id @default(cuid())
  organizationId String
  messageId      String
  message        Message  @relation(...)
  userId         String
  user           User     @relation(...)
  emoji          String
  createdAt      DateTime @default(now())
  @@unique([messageId, userId, emoji])
  @@index([organizationId])
}

model MessageAttachment {
  id             String   @id @default(cuid())
  organizationId String
  messageId      String
  message        Message  @relation(...)
  fileName       String
  fileSize       Int
  mimeType       String
  storageUrl     String
  createdAt      DateTime @default(now())
  @@index([organizationId])
}

model MessageMention {
  id             String   @id @default(cuid())
  organizationId String
  messageId      String
  message        Message  @relation(...)
  mentionedUserId String?
  mentionType    String   // "user" | "channel" | "here" | "team"
  teamId         String?
  createdAt      DateTime @default(now())
  @@index([organizationId])
  @@index([messageId])
}

model NotificationPreference {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  user           User     @relation(...)
  channelId      String?
  channel        Channel? @relation(...)
  level          String   @default("all")  // "all" | "mentions" | "none"
  emailDigest    Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([userId, channelId])
  @@index([organizationId])
}

model PushSubscription {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  user           User     @relation(...)
  endpoint       String
  p256dh         String   // VAPID public key
  auth           String   // VAPID auth secret
  createdAt      DateTime @default(now())
  @@unique([userId, endpoint])
  @@index([organizationId])
}
```

### messagingEnabled on Organization

```prisma
// Source: prisma/schema.prisma — follows aiEnabled pattern
model Organization {
  // ... existing fields ...
  aiEnabled         Boolean  @default(true)
  // Phase 23: Messaging feature gate
  messagingEnabled  Boolean  @default(false)  // D-06: paid feature; default off
  // ...
}
```

### Permission Matrix (D-01 + D-02)

| Permission | super-admin | admin | head-of-schools | principal | member | teacher | viewer | other roles |
|------------|:-----------:|:-----:|:---------------:|:---------:|:------:|:-------:|:------:|:-----------:|
| channels:create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| channels:manage | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| channels:moderate | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| messages:delete:any | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| dms:send | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| integrations:manage | ✓ | ✓ | — | — | — | — | — | — |

Notes:
- super-admin has `*:*` wildcard so no explicit entries needed
- integrations:manage is the same string as the existing INTEGRATIONS_MANAGE — reuse it
- Roles not listed (athletic-director, coach, maintenance-*, it-coordinator, etc.) get channels:create and dms:send since they are operational staff, not viewers

[ASSUMED] The permission mapping for athletic-director, coach, maintenance roles, IT coordinator — they are operational staff so channels:create + dms:send makes sense, but the context.md only specifies "all roles can create/send except viewers". Treat all non-viewer system roles as getting channels:create and dms:send. Exclude viewer, board-member, parent from messaging create/send.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postgres Changes (WAL polling) | Broadcast from Database (`realtime.send()`) | 2024 (Supabase) | Phase 25 uses the newer pattern; Phase 23 just needs tables and RLS |
| `supabase.auth.setAuth()` (deprecated) | `accessToken` option in `createClient()` | 2023-2024 | Phase 25 token endpoint approach is current |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All non-viewer, non-board, non-parent system roles get channels:create and dms:send | Permission Matrix | Wrong roles get/miss messaging access; easy to fix post-deploy |
| A2 | integrations:manage for messaging reuses the existing INTEGRATIONS_MANAGE string from Phase 22 | Permission Matrix | Two separate permission strings would exist with same intent; semantic confusion only |
| A3 | ChannelMember should NOT be in softDeleteModels (hard delete on member removal) | Code Examples | If wrong, removed users can still appear as members until deletedAt filter added to RLS |
| A4 | Trigger for unread decrement (on lastReadAt update) is out of scope for Phase 23 and handled in Phase 25+ | Pitfalls | If both phases expect the other to build it, it gets missed |
| A5 | RLS helper functions messaging_org_id() and messaging_user_id() read camelCase claim names `organizationId` and `userId` — matching the app JWT payload that Phase 25 will copy into the Supabase JWT | Code Examples | If Phase 25 uses different claim names, all RLS policies silently fail |

## Open Questions

1. **integrations:manage collision**
   - What we know: `PERMISSIONS.INTEGRATIONS_MANAGE = 'integrations:manage'` exists and is assigned to admin+ for Phase 22 (PCO, Twilio integrations). The messaging requirements also specify `integrations:manage` for messaging channel integrations.
   - What's unclear: Should this be one shared permission (both Phase 22 and messaging integrations gate off the same check) or a separate `messaging:integrations:manage` string?
   - Recommendation: Reuse the existing string. Admins who can manage PCO/Twilio integrations should also be able to manage messaging integrations. Rename the PERMISSIONS key to be clearer if needed.

2. **Unread count reset trigger**
   - What we know: SCHEMA-05 requires the increment trigger. Decrementing when a user reads (updates `lastReadAt`) is needed for correctness.
   - What's unclear: Is the decrement trigger in scope for Phase 23 or Phase 25?
   - Recommendation: Include both increment AND reset-on-read triggers in Phase 23 since they are part of "the denormalized unread counter" per SCHEMA-05. A counter that only goes up is not functional.

## Environment Availability

Step 2.6: No new external dependencies. Supabase project is already live (`yvpbnzeycowtvuxiidbj`). PostgreSQL, Prisma CLI, and the existing migration setup are confirmed operational. The migration delivery mechanism is `npm run db:push:remote` (CLAUDE.md).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Supabase) | RLS policies, triggers | ✓ | 15+ | — |
| Prisma CLI | Schema migration | ✓ | v5.22 | — |
| `realtime` schema in Supabase | RLS on realtime.messages (Phase 25) | ✓ | managed by Supabase | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 | 8 models exist in Prisma schema, client accepts them | manual-only | `npx prisma validate` (CI) | ❌ Wave 0 |
| SCHEMA-02 | RLS: Org A token cannot read Org B messages | smoke test | `node scripts/smoke-messaging-rls.mjs` | ❌ Wave 0 |
| SCHEMA-03 | Messaging permissions appear in seeded roles | unit | `npx vitest run __tests__/lib/permissions.test.ts -t "messaging"` | ❌ Wave 0 |
| SCHEMA-04 | Organization has messagingEnabled field, default false | unit | `npx vitest run __tests__/lib/schema.test.ts -t "messagingEnabled"` | ❌ Wave 0 |
| SCHEMA-05 | Unread counter increments on message insert | manual-only | Manual SQL: `INSERT INTO "Message"...; SELECT "unreadCount" FROM "ChannelMember"...` | N/A |
| SCHEMA-06 | tsvector column exists and GIN index active | manual-only | `\d "Message"` in psql | N/A |

SCHEMA-02 requires two different JWT tokens (two orgs) and a live Supabase connection — this is a smoke test, not unit. SCHEMA-05 and SCHEMA-06 are database-layer validations; unit tests are impractical without a real DB. The smoke test is the key quality gate.

### Sampling Rate
- **Per task commit:** `npx prisma validate` (schema correctness, no DB needed)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + smoke-messaging-rls.mjs passes before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-messaging-rls.mjs` — covers SCHEMA-02 RLS isolation test
- [ ] `__tests__/lib/permissions.test.ts` — extend existing or create; covers SCHEMA-03
- [ ] Manual SQL validation checklist for SCHEMA-05 and SCHEMA-06

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no new auth flows |
| V3 Session Management | no | N/A — existing JWT session handling |
| V4 Access Control | yes | RLS policies + orgScopedPrisma extension (belt and suspenders per D-03) |
| V5 Input Validation | yes | Zod validation on all future route inputs; schema layer is just data model |
| V6 Cryptography | no | N/A — no new crypto; Phase 25 will use Supabase JWT secret for token exchange |

### Known Threat Patterns for Messaging Schema + RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data leakage | Information Disclosure | RLS org isolation policy + Prisma org-scoped extension |
| Channel snooping (valid org user, wrong channel) | Information Disclosure | RLS channel membership check (D-04) |
| Unread counter manipulation via direct DB access | Tampering | RLS only allows writes from authenticated role with matching JWT |
| Trigger bypass via rawPrisma in app code | Elevation of Privilege | Never use rawPrisma inside route handlers (CLAUDE.md rule) |

## Sources

### Primary (HIGH confidence)
- `/Users/mkerley/Desktop/Linfield Test/src/lib/db/index.ts` — orgScopedModels + softDeleteModels pattern [VERIFIED: codebase read]
- `/Users/mkerley/Desktop/Linfield Test/src/lib/permissions.ts` — PERMISSIONS + DEFAULT_ROLES pattern [VERIFIED: codebase read]
- `/Users/mkerley/Desktop/Linfield Test/src/lib/services/organizationRegistrationService.ts` — seedOrgDefaults + syncRolePermissions [VERIFIED: codebase read]
- `/Users/mkerley/Desktop/Linfield Test/src/lib/auth.ts` — JWT payload structure: `{ userId, organizationId, email }` [VERIFIED: codebase read]
- `/Users/mkerley/Desktop/Linfield Test/prisma/schema.prisma` — Organization model fields (aiEnabled pattern for messagingEnabled) [VERIFIED: codebase read]
- [Supabase Realtime Authorization docs](https://supabase.com/docs/guides/realtime/authorization) — RLS on realtime.messages, realtime.topic() [CITED]

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #28483](https://github.com/orgs/supabase/discussions/28483) — Custom JWT + Realtime: `role: 'authenticated'` required in payload, `typ` header no longer enforced [CITED]
- [Queen Raae — JWT Exchange Pattern (May 2025)](https://queen.raae.codes/2025-05-01-supabase-exchange/) — Token exchange approach for custom auth with Supabase RLS [CITED]

### Tertiary (LOW confidence)
- Unread counter trigger SQL and tsvector trigger SQL are [ASSUMED] based on standard Postgres patterns — no official source verified in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in codebase
- Architecture: HIGH — follows existing Prisma extension and permission seeding patterns exactly
- RLS/JWT: MEDIUM — token exchange requirement confirmed via official docs and discussion; exact claim names for RLS helpers are ASSUMED to match what Phase 25 will produce
- Trigger SQL: LOW — standard Postgres but not verified against a running instance

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (Supabase API changes slowly; Prisma v5 API is stable)
