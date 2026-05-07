# Project Research Summary

**Project:** Lionheart v4.0 — Staff Messaging Module
**Domain:** Slack-like real-time staff communication embedded in K-12 school management SaaS
**Researched:** 2026-05-07
**Confidence:** HIGH

## Executive Summary

Lionheart v4.0 adds Slack-style staff messaging to an existing platform that already handles events, tickets, maintenance, and facilities for K-12 schools. The good news is that 80% of the infrastructure is already in place: Supabase Realtime (used today in event chat and presence hooks), Supabase Storage (used for avatars and attachments), the org-scoped Prisma client, the permission system, the notification model, and a PWA service worker. This is not a greenfield messaging build — it is a scaled-up, org-gated version of patterns already proven in the codebase.

The recommended approach is Supabase Realtime with the "Broadcast-from-Database" pattern: Prisma writes the message, a Postgres trigger broadcasts it to subscribers via `realtime.send()`, and clients listen on a WebSocket. This avoids the N-queries-per-subscriber problem that plagues the simpler "Postgres Changes" approach. The custom HS256 JWT needs one integration step to work with Realtime — using the `accessToken` option on the Supabase client, plus custom RLS policies that read from `auth.jwt()` claims rather than `auth.uid()`. This is the highest-risk integration point and must be proven before UI work starts.

The main risks are tenant isolation (Supabase Realtime bypasses the Prisma org-scoping layer entirely, so RLS policies on messaging tables are not optional), FERPA compliance (staff messages about students become education records), and unread-count scaling (COUNT(*) on every badge refresh is a time bomb). All three are solvable with the right schema decisions upfront — they are expensive to fix retroactively. Phase numbering continues from 22 (the previous milestone), so the messaging milestone starts at Phase 23.

---

## Key Findings

### Recommended Stack

The existing stack handles everything. The only new dependencies are `react-virtuoso` (virtual scroll for message lists — the only library with a native chat API), `web-push` (VAPID push notifications without a Google dependency), `emoji-picker-react` (lightweight, no peer deps), and `react-markdown` + `remark-gfm` + `rehype-sanitize` (safe markdown rendering). The `@supabase/supabase-js` package needs a version bump from `^2.49.1` to `^2.105.3` for realtime channel error surfacing fixes.

Three env vars need to be added for web push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_EMAIL`. Everything else uses existing env vars.

**Core technologies:**
- `@supabase/supabase-js` ^2.105.3 — Realtime WebSocket transport — already in stack, version bump only
- `react-virtuoso` ^4.18.6 — virtual scroll for messages — only library with native chat/reverse-scroll API
- `web-push` ^3.6.7 — browser push notifications — no FCM/Google dependency
- `emoji-picker-react` ^4.19.1 — emoji picker — lightweight, ships its own data
- `react-markdown` ^10.1.0 + `remark-gfm` ^4.0.1 + `rehype-sanitize` ^6.0.0 — safe markdown in messages
- Postgres `tsvector` + GIN index — full-text search — no external service, handles school-scale volumes

**What not to add:** Socket.io, Ably, Pusher, Redis, Stream Chat SDK, Sendbird, Firebase Cloud Messaging, TipTap, Elasticsearch, Algolia. Each would add infrastructure cost, conflict with the existing data model, or solve a problem the current stack already handles.

### Expected Features

Staff messaging in 2026 has a high table-stakes bar set by Slack. Missing any of the items in the "must have" list makes the product feel unfinished.

**Must have at launch (MVP):**
- Public channels, direct messages (1:1), send/edit/delete messages
- @user mentions with in-app notification
- Emoji reactions (standard set only)
- Unread badge + read state (cursor-based, not per-message row)
- File attachments (images + PDFs via Supabase Storage)
- Typing indicator + basic presence (online/offline)
- Full-text message search (Postgres tsvector, scoped to org)
- Mute channel, pin messages

**Should have (differentiators that justify building custom vs. using Slack):**
- Auto-channels from tickets and events — discussion lives with the work item, not in someone's DMs
- System bot alerts — ticket status changes post automatically to the ticket's channel
- Lionheart URL rich previews — paste a ticket/event URL, get a card with title/status/assignee
- Web push notifications — critical for on-call maintenance staff away from their desks
- Email digest — for staff who don't live in the app daily
- Context bridge — see the last 3 channel messages from inside a ticket drawer

**Defer to Phase 2 of messaging (not in MVP):**
- Message threads (complex reply-in-thread UX — ship flat first)
- Private channels and group DMs
- Slash commands (`/ticket create`, `/event lookup`)
- Auto-channels from teams and schools (lower urgency than ticket/event)

**Explicit anti-features (never build):**
- Student-facing or parent-facing channels (COPPA risk, wrong use case)
- Video/audio calling (Zoom/Meet are free, no upside)
- Custom emoji uploads, Giphy, GIF support (unprofessional in school context)
- AI message summarization in v4 (add later as paid add-on)

### Architecture Approach

The messaging module follows the existing patterns exactly: org-scoped Prisma models, `runWithOrgContext` in every route, `assertCan` permission checks, and the `ok()`/`fail()` response envelope. What's new is a second data access path — Supabase Realtime — that bypasses Prisma entirely. This path requires its own security layer (RLS policies on Postgres tables) and its own Supabase client instance (singleton, initialized once in `DashboardLayout`, using the `accessToken` option with the custom JWT).

The Realtime delivery pattern is Broadcast-from-Database: Prisma writes the message row, a Postgres trigger calls `realtime.send()`, and the Supabase Realtime cluster fans out to all subscribed clients. Clients subscribe to `messaging:{orgId}:{channelId}` — the `orgId` prefix is defense-in-depth even if RLS has a gap. The existing `useEventChat.ts` and `usePresence.ts` hooks are the proof-of-concept; this module is their production-scale version.

**Major components:**
1. `src/lib/supabase-messaging-client.ts` — singleton Supabase client with `accessToken` option (separate from `supabase-browser.ts`)
2. `src/app/api/messaging/` — channel CRUD, message CRUD, DMs, search, preferences (all org-scoped, all permissioned)
3. `src/lib/services/messaging/` — channelService, messageService, notificationService, presenceService
4. `src/lib/hooks/messaging/` — useMessaging, useChannelMessages, useChannelList, usePresenceTracker, useUnreadCounts
5. `src/components/messaging/` — MessagingLayout, ChannelList, MessageArea, MessageComposer, MessageItem, ThreadPanel
6. Postgres trigger — fires on `Message` INSERT, calls `realtime.send()` without RLS-per-subscriber overhead
7. Modified `src/lib/db/index.ts` — add messaging models to `orgScopedModels` and soft-delete sets
8. Modified `prisma/schema.prisma` — Channel, ChannelMember, Message, MessageReaction, MessageAttachment, MessageMention, NotificationPreference, PushSubscription
9. Modified `src/lib/permissions.ts` — add MESSAGING_READ, MESSAGING_SEND, MESSAGING_MANAGE
10. Modified `src/components/sidebar/MainNavContent.tsx` — messaging nav item with unread badge, behind TenantModule gate

The messaging page takes over the full content area (same as Calendar), not a drawer or overlay. Channel list is a left panel (~280px); message area fills the rest. Threads slide in from the right.

### Critical Pitfalls

1. **Cross-tenant data leakage via Realtime** — Prisma org-scoping doesn't protect the Supabase Realtime path. RLS policies on all messaging tables are mandatory before any subscription code ships. Test explicitly with two org tokens. This is a FERPA violation risk.

2. **N authorization queries per message (Postgres Changes pattern)** — Using "Postgres Changes" means one message triggers one RLS check per subscriber. At 200 users, that's 200 DB queries per message. Use Broadcast-from-Database instead. This is an architecture decision that cannot be changed without a rewrite.

3. **httpOnly cookie inaccessible to Supabase client** — The `auth-token` cookie is httpOnly, so the browser's Supabase client can't read it for the `accessToken` callback. Fix: a lightweight `/api/auth/token` endpoint that reads the cookie server-side and returns the raw JWT string to the browser.

4. **Unread counts computed at runtime** — `SELECT COUNT(*) FROM messages WHERE created_at > last_read_at` per channel per user is a silent time bomb. Store unread counts as a denormalized integer on `ChannelMember`, maintained by trigger. Design this into the schema — it cannot be retrofitted easily.

5. **FERPA compliance on auto-channels** — When staff discuss a specific student in a ticket/event channel, those messages become education records. Needs audit logging, a data export endpoint, and a retention policy engine. Required before auto-channels ship.

---

## Implications for Roadmap

The messaging milestone maps to 7 phases (23–29), with hard dependencies driving the order.

### Phase 23: Schema + Permissions + RLS Foundation
**Rationale:** Everything else depends on this. The data model and security layer must exist before any code is written. RLS policies must be tested before any Realtime subscription code ships.
**Delivers:** All 8 Prisma messaging models, org-scoped models registered, MESSAGING_* permissions, RLS policies on all messaging tables, GIN index + tsvector trigger, denormalized unread counter design, Supabase plan connection limit verified.
**Avoids:** Tenant isolation failure, unread count bottleneck, N auth queries per message.
**Research flag:** Standard patterns — well-documented.

### Phase 24: Core API Routes (no Realtime yet)
**Rationale:** Build and validate the REST API fully before adding WebSocket complexity. Smoke tests against the live API validate correctness before any UI is written.
**Delivers:** All `src/app/api/messaging/` routes (channels CRUD, messages CRUD, DMs, search, preferences), channelService, messageService, API smoke tests.
**Avoids:** Building UI on an unvalidated API.
**Research flag:** Standard patterns — identical to existing route conventions.

### Phase 25: Realtime Bridge + JWT Integration
**Rationale:** This is the highest-risk phase. The custom JWT to Supabase Realtime integration has multiple failure modes. Isolate this complexity before building UI on top of it.
**Delivers:** `supabase-messaging-client.ts` singleton with `accessToken`, `/api/auth/token` endpoint, Postgres broadcast trigger, validated RLS policies, cross-org isolation smoke test, polling fallback.
**Avoids:** Wrong delivery mode locked in, Prisma-to-Realtime gap, multiple connections per tab.
**Research flag:** Validate `accessToken` option and RLS claims syntax against the live Supabase project during this phase — sources are MEDIUM confidence.

### Phase 26: Core Messaging UI
**Rationale:** With API and Realtime both working, build the UI. Text messaging only — no attachments, no reactions, no threads. Get something in front of staff as soon as possible.
**Delivers:** MessagingLayout, ChannelList, MessageArea, MessageComposer, MessageItem. Sidebar nav item with unread badge. TenantModule gate. Messaging pages at `/messaging/[channelId]`.
**Addresses:** Public channels, DMs, send/edit/delete, @mentions, typing indicator, presence (scoped to active channel only to avoid O(n²) broadcast).
**Avoids:** Global presence O(n²) broadcast, permission model creep.
**Research flag:** Standard patterns — follows existing design system.

### Phase 27: Reactions, Threads, File Attachments, Search
**Rationale:** Additive features that build on the working foundation without changing core message flow. No interdependencies between them, but all depend on Phase 26 existing.
**Delivers:** Emoji reactions, message threads (ThreadPanel), file attachments (Supabase Storage, 25MB limit, thumbnail transforms), full-text search (tsvector GIN index, SearchPanel), pin messages, mute channel.
**Addresses:** All table-stakes MVP features. Product is now feature-complete at launch bar.
**Avoids:** Storage egress cost surprise (image thumbnails from day one), FTS degradation at scale (persisted tsvector column).
**Research flag:** Standard patterns for all items.

### Phase 28: Notifications + Read State
**Rationale:** Correct notification defaults must be in place before broad rollout. Defaults are a product decision with major adoption consequences.
**Delivers:** Email digest (Resend), web push (VAPID, extending existing PWA service worker), per-channel notification preferences, read state cursor tracking, unread badge sync.
**Default settings:** DMs = immediate, channels = digest, auto-channels = muted.
**Avoids:** Notification fatigue killing adoption, per-message read row bottleneck.
**Research flag:** Web push needs real-device testing (Safari iOS requires PWA install). Flag as nice-to-have until confirmed.

### Phase 29: Auto-Channels + System Bot + Integrations
**Rationale:** The differentiating features that justify building custom messaging. Highest complexity, requires lifecycle hooks on tickets/events. Defer until core experience is proven.
**Delivers:** Lazy auto-channel creation on first click (not on ticket/event creation — prevents channel graveyard), auto-archive on close, system bot user with bot flag, status-change messages, Lionheart URL rich previews, context bridge in ticket drawer, audit logging for student-related channels.
**Addresses:** All "should have" differentiator features.
**Avoids:** Auto-channel spam, FERPA gaps in auto-channels.
**Research flag:** Needs phase research — lifecycle hook integration and FERPA audit log requirements are complex.

### Phase Ordering Rationale

The order is driven by hard dependencies. Schema must precede API. API must precede Realtime (so there is a working fallback if Realtime has issues during Phase 25). Realtime must precede UI so the UI is not built on a broken transport. Core UI must precede enrichment features. Notifications before broad rollout. Auto-channels last because they depend on everything else and introduce the highest compliance complexity.

### Research Flags

Needs deeper research during planning:
- **Phase 25 (Realtime Bridge):** Custom JWT + Supabase Realtime `accessToken` option has MEDIUM-confidence sources. Validate against live Supabase project before committing to implementation.
- **Phase 29 (Auto-Channels + Integrations):** Ticket/event lifecycle hooks, bot user architecture, and FERPA audit log requirements warrant a research-phase pass before planning.

Standard patterns (skip research-phase):
- **Phase 23 (Schema):** Prisma + Supabase RLS syntax is well-documented.
- **Phase 24 (API Routes):** Identical to existing route pattern.
- **Phase 26 (Core UI):** Follows existing design system.
- **Phase 27 (Enrichment):** Additive features on proven foundation.
- **Phase 28 (Notifications):** VAPID pattern is well-documented; main unknown is device testing.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack validated. New libraries are well-documented. web-push VAPID has clear official docs. |
| Features | HIGH | Based on competitive analysis of Slack, Teams, Pumble, Chanty, Rocket.Chat plus K-12-specific tools. Table stakes list grounded in real usage. |
| Architecture | HIGH | Built on patterns proven in the codebase (useEventChat.ts, usePresence.ts). Broadcast-from-Database recommendation has HIGH-confidence sources. Custom JWT integration has MEDIUM-confidence sources — validate in Phase 25. |
| Pitfalls | HIGH (Supabase limits) / MEDIUM (FERPA nuances) | Connection limits, RLS scaling, storage egress are documented facts. FERPA compliance nuances should have institutional counsel review before auto-channels ship. |

**Overall confidence:** HIGH

### Gaps to Address

- **httpOnly cookie + Supabase client:** The `/api/auth/token` endpoint workaround is correct but needs confirmation during Phase 25. Alternative: expose a non-httpOnly short-lived messaging token.
- **Supabase plan capacity:** Pro plan allows 500 concurrent connections. Confirm current project tier and connection usage before Phase 26 rolls out to staff. Upgrade path exists but costs money.
- **FERPA review:** Retention policy engine and data export endpoint must be built before auto-channels go live. Legal review recommended before Phase 29 planning.
- **Web push iOS behavior:** Confirm the existing PWA manifest meets Apple's requirements before committing web push as a primary notification channel.

---

## Sources

### Primary (HIGH confidence)
- Supabase Realtime Docs (supabase.com/docs/guides/realtime) — Broadcast, Presence, connection limits
- Supabase Realtime Authorization (supabase.com/docs/guides/realtime/authorization) — RLS + custom JWT
- Broadcast from Database (supabase.com/blog/realtime-broadcast-from-database) — trigger pattern
- Supabase JS releases (github.com/supabase/supabase-js) — v2.105.3 changelog
- Existing codebase (src/lib/hooks/useEventChat.ts, usePresence.ts, supabase-browser.ts) — verified integration patterns
- web-push npm (npmjs.com/package/web-push) — v3.6.7
- react-virtuoso (virtuoso.dev) — VirtuosoMessageList API
- react-markdown (remarkjs.github.io/react-markdown) — v10.1.0

### Secondary (MEDIUM confidence)
- Custom JWT with Supabase Realtime (github.com/orgs/supabase/discussions) — accessToken option pattern
- RLS policy claims pattern (queen.raae.codes) — `current_setting` JWT claims syntax
- Unread count architecture (theskilledcoder.com) — cursor vs COUNT(*) tradeoffs
- FERPA Compliance Checklist 2026 (brightdefense.com) — educational data requirements
- Notification fatigue research (courier.com) — default settings recommendations
- Slack, Teams, Pumble, Chanty, Rocket.Chat — feature expectation baseline

### Tertiary (LOW confidence)
- Postgres FTS vs external search scale thresholds — validate with actual message volumes during Phase 27

---

*Research completed: 2026-05-07*
*Ready for roadmap: yes*
