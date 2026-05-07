# Domain Pitfalls: Real-Time Messaging on a Multi-Tenant Educational Platform

**Domain:** Slack-like staff messaging added to existing Next.js 15 / Supabase / Prisma SaaS
**Researched:** 2026-05-07
**Confidence:** HIGH (Supabase limits and architecture) / MEDIUM (educational compliance nuances)

---

## Critical Pitfalls

Mistakes that cause rewrites, data leaks, or compliance failures.

---

### Pitfall 1: Tenant Isolation Failure via Client-Side Supabase

**What goes wrong:** The app currently uses Prisma for all writes, which enforces org-scoping via `runWithOrgContext`. Supabase Realtime subscriptions happen on the client using the Supabase JS client — which uses its own auth context. If the client subscribes to a channel using `filter: 'organization_id=eq.X'` without RLS backing it up in the database, a user who manipulates the filter parameter client-side could subscribe to another org's messages. "You won't notice in testing because your test user probably has access to everything in your dev database."

**Why it happens:** The existing app never needed RLS because Prisma handled scoping server-side. Adding Supabase Realtime means adding a second data access path that bypasses Prisma entirely.

**Consequences:** Cross-tenant message leakage. FERPA violation. Potentially catastrophic for a school platform.

**Prevention:**
- Enable RLS on every messaging table (`Channel`, `Message`, `MessageRead`, `ChannelMember`, etc.) before adding them to the Supabase Realtime publication.
- Write RLS policies that check `organization_id = auth.jwt() -> 'organizationId'` or use a session variable set from the JWT.
- Since the app uses custom JWTs (not Supabase Auth), configure Supabase to trust the app's JWT by setting the JWT secret in Supabase project settings to match `AUTH_SECRET`. The `auth.uid()` function won't help — use `auth.jwt() ->> 'organizationId'` in policies.
- Test isolation explicitly: create two orgs, subscribe with Org A credentials, confirm zero Org B messages arrive.

**Detection:** Any Supabase Realtime subscription that works without the user being authenticated is a red flag. Run the smoke test after enabling RLS — if data still arrives on a token from a different org, the policy is wrong.

**Phase:** Must be addressed in the schema setup phase, before any Realtime subscription code is written.

---

### Pitfall 2: Postgres Changes + RLS = N Authorization Queries per Message

**What goes wrong:** Supabase Realtime "Postgres Changes" runs an RLS authorization check against every subscribed client for every row change. With 100 users in a channel and one message sent, that one INSERT generates 100 database authorization queries. At any reasonable school size (200+ staff, multiple active channels), this creates a serious database bottleneck that compounds with message volume.

**Why it happens:** The Postgres Changes feature is designed for simplicity, not high throughput. The RLS-per-subscriber model doesn't scale.

**Consequences:** Query load grows as `(messages/sec) × (active subscribers)`. A busy day with 50 messages/minute and 200 connected users is 10,000 auth queries/minute just for message delivery.

**Prevention:** Use the Broadcast pattern instead of Postgres Changes for message delivery.
1. Server-side route writes the message to Postgres via Prisma (already org-scoped, already auditable).
2. Server-side route then broadcasts the message to the Supabase channel using the server-side Supabase client: `supabase.channel('org:ABC123').send(...)`.
3. Clients subscribe to Broadcast, not Postgres Changes.

This is more setup but scales to thousands of concurrent users without piling up DB auth queries. The Supabase docs explicitly recommend this pattern for scale.

**Detection:** Watch `pg_stat_activity` during load testing. If you see hundreds of near-identical auth-checking queries per second, you're in this trap.

**Phase:** Architecture decision that must be made in Phase 1 before any subscription code ships.

---

### Pitfall 3: The Prisma-to-Realtime Gap (Writes Don't Auto-Broadcast)

**What goes wrong:** Prisma writes go through the pooled `DATABASE_URL` connection. Supabase Realtime listens to PostgreSQL's WAL (Write-Ahead Log) replication stream. These are two separate systems. Prisma does not trigger Supabase Realtime events automatically just by writing to the DB — the table must be added to the `supabase_realtime` publication AND the Realtime service must be able to see the change.

There is a known issue where Prisma migrations can break Realtime subscriptions on specific table types. Quoted type names in Prisma-generated DDL have caused Realtime to silently stop delivering events on those tables.

**Why it happens:** Most teams assume "write to DB → Realtime fires." This is true for Supabase's own client writes, but Prisma's pooled connection goes through PgBouncer, which can suppress WAL events in some configurations.

**Consequences:** Messages silently don't deliver in real-time. Users see messages only on refresh. No error is thrown anywhere.

**Prevention:**
- Use the Broadcast approach (Pitfall 2 prevention) as the primary delivery path — this sidesteps the WAL gap entirely.
- If using Postgres Changes as a fallback, verify the table is in the publication: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
- After every `db:push` or migration, run a connectivity test: subscribe on the client, insert a test row server-side, confirm the event arrives.
- Use `REPLICA IDENTITY FULL` on message tables if you need UPDATE/DELETE change data (required to get the old row values).

**Detection:** Write a smoke test that inserts a message and checks whether the Realtime event fires within 2 seconds. Put this in CI.

**Phase:** Phase 1 integration testing. Required before any UI is built.

---

### Pitfall 4: Supabase Realtime Connection Limits Hit Faster Than Expected

**What goes wrong:** Supabase Realtime connection limits are per-project, not per-org. The current Pro plan allows **500 concurrent connections**. Each open browser tab with an active Supabase Realtime subscription counts as one connection.

A school with 200 staff, if half are active simultaneously with multiple tabs open, could easily hit 300-400 connections. Multiple schools on the same Supabase project share that limit. On the Free tier, the limit is **200 connections total**.

Rate limits are also per-project:
- Free: 100 messages/second, 20 presence messages/second
- Pro: 500 messages/second, 50 presence messages/second
- Pro (no spend cap) / Team: 2,500 messages/second

**Why it happens:** Connection counts aren't visible until they're a problem. Each channel subscription is a connection.

**Consequences:** New users get "connection refused" or silent failures when the limit is hit. Existing connections survive; new ones don't. Hard to debug — it looks like a network issue to the end user.

**Prevention:**
- Multiplex subscriptions: one client should open one channel connection and subscribe to multiple topics on it, not open one connection per channel.
- Implement connection pooling on the client: a singleton Supabase client instance per browser tab, not per component.
- Plan for Pro plan with spend cap removed (10,000 connections) before any broad rollout.
- Add connection count monitoring as a health metric.

**Detection:** Monitor `realtime_peak_connections` in the Supabase dashboard. Alert at 70% of the limit.

**Phase:** Phase 1 architecture (singleton client), Phase 3 load testing, upgrade plan before launch.

---

### Pitfall 5: FERPA Compliance Gaps in Staff Messaging

**What goes wrong:** FERPA regulates any "education records" — records that are directly related to a student and maintained by an educational institution. If staff members discuss a student's behavior, medical situation, IEP, or attendance in a messaging channel, those messages become education records subject to FERPA.

Common mistakes:
- No audit log of who accessed message history containing student PII.
- No ability for the institution to produce records in response to a FERPA request.
- No data retention policy (FERPA requires institutions to be able to define and enforce retention).
- Messages in auto-channels (e.g., a Ticket channel for a student's accommodation request) containing student data that are visible to staff who don't have a "legitimate educational interest."
- File attachments containing student data stored without encryption-at-rest verification.

**Why it happens:** Teams treat messaging as "just staff chat" and don't realize content makes it a governed record.

**Consequences:** Institutional FERPA violation. Schools risk losing federal funding. The SaaS vendor (Lionheart) faces liability if the platform facilitates the violation.

**Prevention:**
- Add an audit log for message reads in sensitive channels (auto-channels linked to tickets/events involving students).
- Build a data export endpoint: given a student ID, return all messages referencing that student (requires a search index with entity linking).
- Add per-channel data classification: "contains student records" flag, which triggers stricter access control and audit logging.
- Ensure Supabase Storage encryption-at-rest is confirmed on the project (it is on by default for hosted Supabase — verify, don't assume).
- Build a retention policy engine: channels can have a retention period; expired messages are hard-deleted, not just hidden.
- Document in the school's data processing agreement (DPA) that Lionheart is a "school official" under FERPA, acting on the school's behalf with a legitimate educational interest.

**Detection:** Review auto-channel creation logic. If a ticket or event involving a student auto-creates a messaging channel, all messages in that channel are candidate education records.

**Phase:** Phase 1 design (data classification), Phase 2 (audit logging), Phase 4 (retention policy).

---

### Pitfall 6: Unread Counts Become a Database Bottleneck

**What goes wrong:** Unread counts look simple: `SELECT COUNT(*) FROM messages WHERE channel_id = X AND created_at > (SELECT last_read FROM channel_members WHERE user_id = Y)`. In practice, at scale across many channels and users, this is one of the most expensive queries in a messaging system.

Each page load, each notification badge refresh, and each connection re-open triggers these counts across every channel the user belongs to. With 20 channels per user and 200 users, that's 4,000 count queries per refresh cycle.

**Why it happens:** COUNT(*) with a timestamp watermark requires a full index scan. The watermark approach also has race conditions: two messages arriving simultaneously both read the same watermark and one gets missed.

**Consequences:** The dashboard sidebar with unread badges becomes the slowest part of the app. DB CPU spikes on reconnect storms (when many users reconnect simultaneously after a brief outage).

**Prevention:**
- Store unread count as a denormalized integer on `ChannelMember` and decrement/increment on message insert/read. Avoid COUNT(*) at runtime.
- Use Postgres triggers or application-level logic to maintain the counter — do NOT rely on computing it on every request.
- Batch the initial load: return all channel summaries (including unread counts) in a single query on login, not one query per channel.
- Implement a "mark all as read" that sets the counter to 0 atomically rather than updating a timestamp watermark.

**Detection:** EXPLAIN ANALYZE on the unread count query at 100K+ messages. If you see sequential scans, the design is wrong.

**Phase:** Schema design in Phase 1. Hard to fix retroactively once messages accumulate.

---

## Moderate Pitfalls

---

### Pitfall 7: Presence Tracking Creates O(n²) Broadcast Volume

**What goes wrong:** Supabase Presence broadcasts a "state sync" to all connected clients whenever any user's presence changes (joins, leaves, changes status). With N users online, each join/leave triggers N broadcasts. At 100 concurrent users, one user connecting triggers 100 state updates. This is acceptable up to ~50-100 users; it degrades sharply after that.

**Prevention:**
- Don't use Supabase Presence for global online/offline status across the whole org. Scope presence to individual channels or active conversations.
- Consider a lighter presence model: store a `last_seen_at` timestamp in the DB and update it on activity. Show "online" only if `last_seen_at > now() - 5 minutes`. This scales linearly and survives reconnects.
- If using Supabase Presence, limit it to the active channel view only — not the sidebar.

**Phase:** Phase 2 when implementing presence UI.

---

### Pitfall 8: File Attachment Bandwidth Costs Surprise

**What goes wrong:** Supabase Storage egress is billed at $0.09/GB above the included quota (250 GB on Pro). A messaging system where staff share photos, PDFs, and documents can burn through this quickly. Images served from Storage without a CDN layer count as full egress every time they're loaded.

**Prevention:**
- Put Cloudflare (already likely in use via Vercel/Cloudflare) in front of Supabase Storage for public buckets, or use Supabase's Smart CDN feature (Pro plan).
- Use Supabase's built-in image transformations for thumbnails: serve a 200px thumbnail in the message feed, full size only on click. This alone can cut image egress by 80%.
- Set per-file size limits: 25MB per attachment, 100MB per channel per day. Enforce server-side before upload.
- Store only file metadata in the `Message` table; keep actual files in a separate `MessageAttachment` table with the Supabase Storage path.

**Phase:** Phase 2 (file upload implementation). Cost becomes real in Phase 4+ (production rollout).

---

### Pitfall 9: Permission Model Creep (Two-Layer Role Hell)

**What goes wrong:** The app has an existing org-level permission model (super-admin, admin, member, viewer). Messaging adds channel-level roles (channel owner, channel admin, channel member, read-only). These two systems need to interact: an org admin should be able to see all channels. A channel owner who is only a "member" org-role should be able to manage their channel.

This starts simple and grows. Slack took years and multiple rewrites to get this right. The failure mode is a permission check that asks both systems sequentially, with unclear precedence rules.

**Prevention:**
- Define the precedence rule once and write it in a comment: "org-level permissions always override channel-level. An org admin can always see any channel. Channel roles only extend permissions downward (grant more), never upward."
- Implement a single `canAccessChannel(userId, channelId)` function that checks both layers in one place. Do not scatter channel permission checks across components.
- Limit channel roles to: `owner`, `member`, `read-only`. Resist adding more until there is a concrete use case.
- Do not expose the channel role model to the org permission UI. Keep them separate in the UI even if they interact in code.

**Phase:** Phase 1 design. Scope creep risk highest in Phase 3 (private channels, DMs).

---

### Pitfall 10: Notification Fatigue Kills Adoption

**What goes wrong:** School staff are already overwhelmed with email and in-app notifications from tickets, events, and maintenance. Adding messaging notifications on top without careful defaults creates an environment where every notification gets ignored. Research shows: a field worker receiving 40-60 notifications per 12-hour shift classifies all of them as low priority within two weeks.

**Prevention:**
- Default notification settings to: DMs = notify immediately; @mentions = notify immediately; channel messages = digest (daily summary).
- Build per-channel mute controls on day one — not as a future iteration. Users will need them.
- Never send a notification for a message in a channel the user hasn't opened in 7+ days without asking if they want to stay.
- Distinguish between notification types in the Resend email templates: a DM gets a different email format than a channel digest.
- Auto-channels from tickets/events should default to muted for all users except the ticket assignee and event owner.

**Phase:** Phase 2 (notification system). Default settings are a product decision that should be made before shipping.

---

### Pitfall 11: Message Database Growth Is Unbounded Without a Plan

**What goes wrong:** A messaging table with no retention policy grows forever. At a conservative 500 messages/day across a school, that's 180,000 rows/year. With 50 schools, that's 9 million rows in year one. Full-text search, unread counts, and notification queries all degrade as the table grows.

**Prevention:**
- Design a retention policy system from day one: per-channel TTL (30 days, 90 days, 1 year, forever).
- Implement a background job (Vercel Cron or Supabase Edge Function) that hard-deletes messages older than the channel's TTL.
- Soft-delete messages that users delete individually; hard-delete on retention sweep.
- Partition the `Message` table by month using Postgres partitioning if expecting high volume. This is easier to add before data accumulates.
- Archive old messages to cold storage (Supabase Storage as JSON) rather than keeping them live in Postgres.

**Phase:** Phase 1 schema design. Cannot be retrofitted painlessly.

---

## Minor Pitfalls

---

### Pitfall 12: React Component Creates Multiple Supabase Connections

**What goes wrong:** If the Supabase client is instantiated inside a React component or a `useEffect` without proper cleanup, component re-renders create duplicate connections. "The number one mistake React developers make with WebSockets is creating the connection inside a component that mounts and unmounts."

**Prevention:** One singleton Supabase client per browser session. Export it from a module (`src/lib/supabase-client.ts`), never instantiate it in a component. Always call `channel.unsubscribe()` in the `useEffect` cleanup function.

**Phase:** Phase 1 client infrastructure.

---

### Pitfall 13: Full-Text Search Degrades Silently at Scale

**What goes wrong:** Postgres FTS with `tsvector` and GIN index works well up to ~500K rows. Beyond that, `ts_rank` requires scoring every matching row, and queries that return in 50ms at 10K rows take several seconds at 10M rows.

**Prevention:**
- Use a persisted `tsvector` column (updated by trigger or application logic) rather than computing at query time.
- Plan for `pg_textsearch` (BM25-based, 2-6x faster than standard FTS) or an external search service (Typesense self-hosted, or Meilisearch) as an upgrade path.
- Limit search scope by default: search within current channel before searching all channels. This keeps the result set bounded.
- Add `created_at DESC` index alongside the GIN index so recency-filtered searches use the index efficiently.

**Phase:** Phase 3 (search feature). Upgrade path planning in Phase 5.

---

### Pitfall 14: Web Push Requires HTTPS and Safari Caveats

**What goes wrong:** Web Push (VAPID) requires HTTPS everywhere — not just in production. Local dev using `localhost` works in Chrome but not in all browsers. Safari requires iOS 16.4+ and macOS Ventura+ for web push, and the app must be installed as a PWA (added to home screen) for push to work on iOS.

**Prevention:**
- Test push on real devices before committing to web push as a notification channel.
- Fall back to email digest for users whose browsers don't support push or who haven't granted permission.
- Request push permission only after the user has sent their first message or explicitly visited notification settings — not on first login.
- Never use the same VAPID key pair in dev and production.

**Phase:** Phase 3 (notification delivery). Flag as "nice-to-have" until user testing confirms demand.

---

### Pitfall 15: Auto-Channel Spam on Ticket/Event Creation

**What goes wrong:** Auto-creating a messaging channel for every ticket and every event sounds great in planning. In practice, a school with 200 maintenance tickets/month and 50 events/month generates 250 new channels/month. Most go unused. The channel list becomes unmanageable. The "Channels" section of the sidebar becomes a graveyard.

**Prevention:**
- Do not auto-create channels. Auto-create them lazily: the first time someone clicks "Open Channel" on a ticket or event.
- Archive channels automatically when their parent ticket/event closes. Archiving hides the channel from the active list but preserves history.
- Show ticket/event channels in a separate "Linked Channels" section, not in the main channel list.

**Phase:** Phase 4 (auto-channels / integrations). Design decision that affects UX from day one.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema design | No RLS on messaging tables → cross-tenant leakage | Write RLS policies before any Realtime subscription code |
| Realtime architecture | Postgres Changes + RLS = N auth queries per message | Use Broadcast pattern for message delivery |
| Client infrastructure | Multiple Supabase connections per tab | Singleton client module, never instantiate in components |
| Unread counts | COUNT(*) on every badge refresh | Denormalized counter on ChannelMember, updated by trigger |
| Presence | O(n²) broadcast volume with global presence | Scope presence to active channel only |
| File attachments | Unbounded Storage egress costs | Cloudflare CDN + image transformation for thumbnails |
| Permissions | Two-layer role model with unclear precedence | Single `canAccessChannel()` function, document precedence once |
| Notifications | Default settings cause fatigue | DMs=immediate, channels=digest, auto-channels=muted |
| Message retention | Unbounded table growth → search/count degradation | Retention policy engine + background sweep job |
| Auto-channels | Channel graveyard from ticket/event spam | Lazy creation + auto-archive on close |
| FERPA | Student-related messages in auto-channels | Audit log + data classification + retention enforcement |
| Full-text search | ts_rank degradation at 500K+ messages | Persisted tsvector, plan for pg_textsearch upgrade |
| Web push | iOS requires PWA install, Safari 16.4+ only | Email fallback, permission gating after first engagement |
| Connection limits | 500 concurrent connections on Pro plan | Multiplex subscriptions, plan upgrade before rollout |

---

## "Looks Done But Isn't" Checklist

These items commonly pass QA but have hidden gaps:

- [ ] RLS policies exist on messaging tables — but are they tested with a token from a *different* org?
- [ ] Messages deliver in real-time in dev — but does it work through PgBouncer on the pooled `DATABASE_URL`?
- [ ] Unread counts display correctly — but are they computed at request time (time bomb) or stored (safe)?
- [ ] Notification emails send — but do they batch, or does a busy channel send 50 individual emails per hour?
- [ ] File uploads work — but are the Storage buckets set to private with signed URLs, or accidentally public?
- [ ] Channels are org-scoped in the API — but can a user subscribe to another org's Realtime channel client-side?
- [ ] FERPA policy page exists — but does the platform actually implement the data export and retention deletion it promises?
- [ ] Auto-channels created on ticket creation — but are they archived when the ticket closes?
- [ ] Presence shows who's online — but does it clean up dead connections (e.g., after browser crash)?

---

## Sources

- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — connection and message rate limits per tier (HIGH confidence)
- [Supabase Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) — RLS behavior, replica identity, publication setup (HIGH confidence)
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) — Broadcast vs Postgres Changes tradeoffs (HIGH confidence)
- [Realtime Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database) — server-side broadcast pattern (HIGH confidence)
- [Supabase Security 2025 Retro](https://supabase.com/blog/supabase-security-2025-retro) — known security surface areas (MEDIUM confidence)
- [Enforcing RLS in Multi-Tenant Architecture](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) — RLS pitfalls in multi-tenant context (MEDIUM confidence)
- [Why Unread Counts Are Harder Than COUNT(*)](https://theskilledcoder.com/posts/create-your-own/why-unread-counts-across-devices-are-harder-than-count-star) — unread count architecture (MEDIUM confidence)
- [WebSocket Security — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) — general WebSocket security (HIGH confidence)
- [Role Management at Slack Engineering](https://slack.engineering/role-management-at-slack/) — permission model evolution (MEDIUM confidence)
- [Supabase Storage Pricing and Egress](https://supabase.com/docs/guides/storage/serving/bandwidth) — bandwidth costs (HIGH confidence)
- [Postgres FTS vs External Search](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch) — scale thresholds (MEDIUM confidence)
- [FERPA Compliance Checklist 2026](https://www.brightdefense.com/blog/ferpa-compliance-checklist/) — educational data compliance requirements (MEDIUM confidence)
- [How to Reduce Notification Fatigue](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas) — notification design patterns (MEDIUM confidence)
- [WebSocket Memory Leaks](https://oneuptime.com/blog/post/2026-01-24-websocket-memory-leak-issues/view) — connection lifecycle pitfalls (MEDIUM confidence)
