# Phase 23: Schema, Permissions, and RLS Foundation - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (8 new models) | model | CRUD | `prisma/schema.prisma` existing module models | exact |
| `src/lib/db/index.ts` (Set registration) | config | CRUD | `src/lib/db/index.ts` existing module additions | exact |
| `src/lib/permissions.ts` (constants + DEFAULT_ROLES) | config | request-response | `src/lib/permissions.ts` Phase 22 additions | exact |
| `src/lib/services/organizationRegistrationService.ts` | service | CRUD | same file — syncRolePermissions() auto-picks up new perms | exact |
| Migration SQL (RLS policies + triggers) | migration | event-driven | no existing SQL migration analog — use RESEARCH.md patterns | none |
| `prisma/schema.prisma` Organization.messagingEnabled | model | CRUD | `prisma/schema.prisma` Organization.aiEnabled field | exact |

---

## Pattern Assignments

### `prisma/schema.prisma` — 8 messaging models

**Analog:** The Phase 22 section of `prisma/schema.prisma` (IntegrationCredential, EventTemplate, etc.)

**Organization relation pattern** — every org-scoped model carries this structure. The `aiEnabled` field is the direct analog for `messagingEnabled` (lines 41-44):

```prisma
// Organization feature flag pattern (lines 41-44)
aiEnabled         Boolean       @default(true)
aiMonthlyLimit    Int           @default(50)
aiCallsUsed       Int           @default(0)
aiCycleResetAt    DateTime?

// Phase 23 addition follows same pattern:
messagingEnabled  Boolean       @default(false)  // paid feature — default off
```

**Org-scoped model pattern** — copy from any recent model like `ITDevice`:

```prisma
// Org-scoped model with soft-delete (pattern from User, ITDevice, etc.)
model SomeModel {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  // ... fields ...
  deletedAt      DateTime?    // soft-delete stamp (omit on junction/reaction tables)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([organizationId])
}
```

**Enum pattern** — declared before the model that uses it:

```prisma
enum ChannelType {
  PUBLIC
  PRIVATE
  DM
  GROUP_DM
}
```

**Self-referential relation pattern** (for Message.parentId threads):

```prisma
// From existing schema — the same self-ref pattern used elsewhere
parentId  String?
parent    SomeModel?  @relation("ThreadReplies", fields: [parentId], references: [id])
replies   SomeModel[] @relation("ThreadReplies")
```

**Unsupported type pattern** for tsvector:

```prisma
// Declare postgres-native types Prisma can't handle
searchVector  Unsupported("tsvector")?
// GIN index goes in migration SQL, NOT here as @@index
```

**Organization relation list** — add all 8 messaging relation arrays to the Organization model, grouped with a comment block following the Phase 22 pattern (lines 193-218 of schema.prisma):

```prisma
// Phase 23: Messaging module relations
channels              Channel[]
channelMembers        ChannelMember[]
messages              Message[]
messageReactions      MessageReaction[]
messageAttachments    MessageAttachment[]
messageMentions       MessageMention[]
notificationPreferences NotificationPreference[]
pushSubscriptions     PushSubscription[]
```

---

### `src/lib/db/index.ts` — orgScopedModels and softDeleteModels

**Analog:** `src/lib/db/index.ts` lines 5-202 (the two Set declarations)

**orgScopedModels addition pattern** — copy the comment-grouped style from lines 60-158:

```typescript
// Phase 23: Messaging module
'Channel',
'ChannelMember',
'Message',
'MessageReaction',
'MessageAttachment',
'MessageMention',
'NotificationPreference',
'PushSubscription',
```

Place this block at the end of `orgScopedModels`, before the closing `])`.

**softDeleteModels addition pattern** — copy the comment-grouped style from lines 161-202. Only Channel and Message get soft-delete. ChannelMember does NOT (see anti-pattern note in RESEARCH.md):

```typescript
// Phase 23: Messaging module
'Channel',
'Message',
```

Place this block at the end of `softDeleteModels`, before the closing `])`.

No other changes to this file are needed. The extension logic at lines 232-324 handles all new models automatically once they are registered in the Sets.

---

### `src/lib/permissions.ts` — PERMISSIONS constants

**Analog:** `src/lib/permissions.ts` lines 253-261 (Phase 22 External Integrations block)

**PERMISSIONS object addition pattern** — insert after the `INTEGRATIONS_GOOGLE_CALENDAR` entry, before the `ALL` wildcard (lines 255-261):

```typescript
// Messaging — Phase 23
// Note: INTEGRATIONS_MANAGE already exists as 'integrations:manage' (line 254).
// Reuse it for messaging integrations — same string, same admin-only gate.
MESSAGING_CHANNELS_CREATE:    'channels:create',
MESSAGING_CHANNELS_MANAGE:    'channels:manage',
MESSAGING_CHANNELS_MODERATE:  'channels:moderate',
MESSAGING_MESSAGES_DELETE_ANY: 'messages:delete:any',
MESSAGING_DMS_SEND:           'dms:send',
// integrations:manage for messaging = PERMISSIONS.INTEGRATIONS_MANAGE (reuse, don't duplicate)
```

**Critical:** `INTEGRATIONS_MANAGE = 'integrations:manage'` is already on line 254. Do NOT add a second constant with the same string. Reference `PERMISSIONS.INTEGRATIONS_MANAGE` in the role mappings below.

---

### `src/lib/permissions.ts` — DEFAULT_ROLES updates

**Analog:** `src/lib/permissions.ts` lines 271-1027 (the full DEFAULT_ROLES object)

**Role update pattern** — follow Phase 22 additions (lines 451-455 in ADMIN, near the end of each role's permissions array):

```typescript
// Pattern: append new permission block at the end of each role's permissions array
// Phase 22 example in ADMIN role (lines 451-455):
// Phase 22: External Integrations
PERMISSIONS.INTEGRATIONS_MANAGE,
PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR,
```

**Permission matrix for Phase 23** (from RESEARCH.md decision D-02):

```typescript
// SUPER_ADMIN: has PERMISSIONS.ALL — no changes needed (wildcard covers everything)

// ADMIN (lines 279-457): add at the end of permissions array
// Phase 23: Messaging
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_CHANNELS_MANAGE,
PERMISSIONS.MESSAGING_CHANNELS_MODERATE,
PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY,
PERMISSIONS.MESSAGING_DMS_SEND,
PERMISSIONS.INTEGRATIONS_MANAGE,  // already in ADMIN — skip (no duplicate)

// HEAD_OF_SCHOOLS (lines 458-545): add at end
// Phase 23: Messaging
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_CHANNELS_MANAGE,
PERMISSIONS.MESSAGING_CHANNELS_MODERATE,
PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY,
PERMISSIONS.MESSAGING_DMS_SEND,

// PRINCIPAL (lines 546-635): add at end
// Phase 23: Messaging
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_CHANNELS_MANAGE,
PERMISSIONS.MESSAGING_CHANNELS_MODERATE,
PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY,
PERMISSIONS.MESSAGING_DMS_SEND,

// MEMBER (lines 637-694): add at end
// Phase 23: Messaging (create + DMs, no moderation)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// TEACHER (lines 695-733): add at end
// Phase 23: Messaging (create + DMs)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// VIEWER (lines 735-759): NO messaging permissions added (read-only role per D-02)

// ATHLETIC_DIRECTOR (lines 760-793): add at end
// Phase 23: Messaging (operational staff)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// COACH (lines 794-817): add at end
// Phase 23: Messaging (operational staff)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// MAINTENANCE_HEAD (lines 818-859): add at end
// Phase 23: Messaging (operational staff)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// MAINTENANCE_TECHNICIAN (lines 860-884): add at end
// Phase 23: Messaging (operational staff)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// IT_COORDINATOR (lines 885-955): add at end
// Phase 23: Messaging (operational staff + integrations)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// STUDENT_TECHNICIAN (lines 956-973): NO messaging (limited role)

// SECRETARY (lines 974-999): add at end
// Phase 23: Messaging (operational staff)
PERMISSIONS.MESSAGING_CHANNELS_CREATE,
PERMISSIONS.MESSAGING_DMS_SEND,

// BOARD_MEMBER (lines 1001-1014): NO messaging (read-only external role)

// PARENT (lines 1015-1026): NO messaging
```

---

### `src/lib/services/organizationRegistrationService.ts`

**No code changes required.** The `syncRolePermissions()` function (lines 375-449) automatically picks up new constants from `DEFAULT_ROLES` on next call. The `seedOrgDefaults()` function (lines 181-362) automatically seeds the new permissions for new orgs via the same loop.

The planner must include a task to call `syncRolePermissions(orgId)` for each existing org after deploying the permission changes. This is already documented in RESEARCH.md Pitfall 4.

---

### Migration SQL — RLS policies + triggers

**No existing analog in this codebase.** Use RESEARCH.md patterns directly.

**RLS helper functions pattern** (from RESEARCH.md Pattern 4):

```sql
-- Helper functions read JWT claims injected by Supabase PostgREST
-- Claim names MUST match what Phase 25 /api/realtime/token endpoint produces
CREATE OR REPLACE FUNCTION messaging_org_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'organizationId'
$$;

CREATE OR REPLACE FUNCTION messaging_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'userId'
$$;
```

Note: `SECURITY DEFINER` prevents the circular RLS dependency on ChannelMember (RESEARCH.md Pitfall 5).

**Enable RLS + policies pattern** (RESEARCH.md Pattern 4):

```sql
ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
-- repeat for all 8 messaging tables

-- Channel SELECT: org match AND user is a member
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

-- ChannelMember SELECT: org match only (no circular join needed)
CREATE POLICY "channelmember_read" ON "ChannelMember"
  FOR SELECT TO authenticated
  USING ("organizationId" = messaging_org_id());
```

**Unread counter trigger pattern** (RESEARCH.md Pattern 5):

```sql
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

-- Reset-on-read trigger (RESEARCH.md open question resolved: include both)
CREATE OR REPLACE FUNCTION reset_unread_on_read()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."lastReadAt" IS DISTINCT FROM OLD."lastReadAt" THEN
    UPDATE "ChannelMember"
    SET "unreadCount" = 0
    WHERE "id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER channelmember_reset_unread
  AFTER UPDATE OF "lastReadAt" ON "ChannelMember"
  FOR EACH ROW
  EXECUTE FUNCTION reset_unread_on_read();
```

**tsvector full-text search trigger pattern** (RESEARCH.md Pattern 6):

```sql
-- Column is declared as Unsupported("tsvector")? in schema.prisma
-- GIN index here, not in schema.prisma @@index
CREATE INDEX "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");

CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

---

## Shared Patterns

### Org-Scoping (applies to all 8 messaging models)
**Source:** `src/lib/db/index.ts` lines 5-158 (orgScopedModels Set)
All 8 models need a string entry in this Set. The extension at lines 232-324 handles the rest automatically.

### Soft-Delete (applies to Channel and Message only)
**Source:** `src/lib/db/index.ts` lines 161-202 (softDeleteModels Set)
Only Channel and Message. ChannelMember is hard-deleted (RESEARCH.md Pitfall 6 — do not add it).

### Permission Format
**Source:** `src/lib/permissions.ts` lines 1-14 (header comment)
Format is `resource:action` or `resource:action:scope`. New constants follow `SCREAMING_SNAKE_CASE` keys.

### Role Seeding
**Source:** `src/lib/services/organizationRegistrationService.ts` lines 181-362 (seedOrgDefaults)
No changes needed. Add constants to DEFAULT_ROLES and both seedOrgDefaults + syncRolePermissions pick them up automatically on next call.

### Test Pattern for Permissions
**Source:** `/Users/mkerley/Desktop/Linfield Test/__tests__/lib/permissions.test.ts` lines 1-44
New messaging permission tests follow the same mock setup: `vi.mock('@/lib/db', ...)` + `makeUser([{ resource, action, scope }])` helper.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Migration SQL (RLS + triggers) | migration | event-driven | No existing RLS migration SQL in this codebase; use RESEARCH.md Pattern 4/5/6 |
| `scripts/smoke-messaging-rls.mjs` | test | request-response | No existing RLS smoke test; new pattern modeled after `scripts/smoke-campus.mjs` |

---

## Key Decisions Captured

**integrations:manage collision** — `PERMISSIONS.INTEGRATIONS_MANAGE = 'integrations:manage'` already exists (line 254). Do not add a duplicate constant. Reference `PERMISSIONS.INTEGRATIONS_MANAGE` directly in the role mappings where messaging integrations are needed.

**ChannelMember soft-delete** — Do NOT add to softDeleteModels. Hard-delete is correct for membership rows. The RLS subquery does not need `AND "deletedAt" IS NULL` if ChannelMember rows are truly deleted.

**messagingEnabled default** — `@default(false)` on Organization (paid feature per D-06). Free/trial orgs do not get messaging.

**tsvector declaration** — Use `Unsupported("tsvector")?` in schema.prisma. GIN index goes in migration SQL only.

**syncRolePermissions for existing orgs** — Must be called after deploy. Already implemented in organizationRegistrationService.ts lines 375-449. Planner should include a one-off migration task.

## Metadata

**Analog search scope:** `prisma/schema.prisma`, `src/lib/db/index.ts`, `src/lib/permissions.ts`, `src/lib/services/organizationRegistrationService.ts`, `__tests__/lib/permissions.test.ts`
**Files scanned:** 5
**Pattern extraction date:** 2026-05-07
