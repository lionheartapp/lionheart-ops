# Phase 23: Schema, Permissions, and RLS Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 23-schema-permissions-and-rls-foundation
**Areas discussed:** Permission granularity, RLS policy approach, messagingEnabled gating, Schema design choices

---

## Permission Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the 6 listed | Stick with REQUIREMENTS.md permissions. Expandable later. | ✓ |
| Add a few more | Add pin, archive, threads as separate permissions. More granular. | |
| Minimal — just 3 | Collapse to channels:manage, messages:manage, dms:send. | |

**User's choice:** Keep the 6 listed
**Notes:** None

### Role Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Open by default | Everyone creates channels and DMs. Admins moderate. | ✓ |
| Restricted by default | Only admins create channels. Members post in assigned channels. | |
| You decide | Claude picks based on existing role patterns. | |

**User's choice:** Open by default
**Notes:** None

---

## RLS Policy Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Both layers | Prisma code protection AND database-level RLS on all messaging tables. | ✓ |
| RLS only for Realtime tables | Only Message and Channel get RLS. Others code-only. | |
| Full RLS on everything | RLS on all tables app-wide, not just messaging. | |

**User's choice:** Both layers
**Notes:** None

### Channel Membership in RLS

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, at the database level | RLS checks org match AND channel membership. | ✓ |
| Org-level only in RLS | Database checks org only. Channel membership enforced by API. | |
| You decide | Claude picks based on Realtime pattern. | |

**User's choice:** Yes, at the database level
**Notes:** None

---

## messagingEnabled Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Hide it completely | Sidebar item gone, API returns errors, zero trace. | ✓ |
| Show but locked | Grayed out with lock icon or upgrade prompt. | |
| You decide | Match existing feature gating pattern. | |

**User's choice:** Hide it completely
**Notes:** None

### Default Value

| Option | Description | Selected |
|--------|-------------|----------|
| ON by default | New schools get messaging immediately. | |
| OFF by default | Schools opt in manually. | |
| Tied to billing plan | Free/trial = off, paid = on. | ✓ |

**User's choice:** Tied to billing plan
**Notes:** Messaging as a paid feature / upgrade incentive.

---

## Schema Design Choices

### DM Model

| Option | Description | Selected |
|--------|-------------|----------|
| DMs are channels | Channel with type DM/GROUP_DM. One API, one search index. | ✓ |
| Separate DM model | Own table and message table. More isolation, doubles API surface. | |
| You decide | Claude picks based on search/notification requirements. | |

**User's choice:** DMs are channels
**Notes:** Matches Slack/Discord internal pattern.

### Thread Replies

| Option | Description | Selected |
|--------|-------------|----------|
| parentId on Message | Reply is a Message with parentId. Denormalized replyCount. | ✓ |
| Separate ThreadReply model | Replies in own table. More joins, second table to sync. | |
| You decide | Claude picks based on Realtime and search. | |

**User's choice:** parentId on Message
**Notes:** None

### Reactions

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user rows | MessageReaction with userId + messageId + emoji. | ✓ |
| Aggregated counts only | Emoji + count on message. Lighter but loses who-reacted. | |

**User's choice:** Per-user rows
**Notes:** Supports who-reacted display and duplicate prevention.

### Unread Counts

| Option | Description | Selected |
|--------|-------------|----------|
| Database trigger | Counter on ChannelMember updates on INSERT. Fast sidebar reads. | ✓ |
| Calculate on demand | COUNT(*) on each sidebar load. No extra column, slower. | |

**User's choice:** Database trigger
**Notes:** Matches SCHEMA-05 requirement.

---

## Claude's Discretion

- RLS SQL syntax, trigger details, migration structure
- Column types and indexes beyond tsvector + GIN
- messagingEnabled interaction with existing Stripe/trial code

## Deferred Ideas

None
