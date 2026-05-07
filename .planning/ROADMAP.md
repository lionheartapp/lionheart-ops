# Roadmap: Lionheart Platform

## Milestones

- ✅ **v1.0 Maintenance & Facilities** — Phases 1-7 (shipped 2026-03-06)
- ✅ **v2.0 Launch Readiness** — Phases 8-18 (completed 2026-03-14)
- ✅ **v3.0 Events Are the Product** — Phases 19-22 (shipped 2026-03-16)
- 🚧 **v4.0 Messaging** — Phases 23-29 (in progress)

## Phases

<details>
<summary>✅ v1.0 Maintenance & Facilities (Phases 1-7) — SHIPPED 2026-03-06</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-06
- [x] Phase 2: Core Tickets (3/3 plans) — completed 2026-03-06
- [x] Phase 3: Kanban & AI (3/3 plans) — completed 2026-03-06
- [x] Phase 4: Assets, QR & PM (3/3 plans) — completed 2026-03-06
- [x] Phase 5: Analytics & Repair Intelligence (3/3 plans) — completed 2026-03-06
- [x] Phase 6: Compliance & Board Reporting (4/4 plans) — completed 2026-03-06
- [x] Phase 7: Knowledge Base & Offline PWA (3/3 plans) — completed 2026-03-06

</details>

<details>
<summary>✅ v2.0 Launch Readiness (Phases 8-18) — COMPLETED 2026-03-14</summary>

- [x] Phase 8: Auth Hardening (4/4 plans) — completed 2026-03-14
- [x] Phase 9: Legal & Compliance Pages (3/3 plans) — completed 2026-03-14
- [x] Phase 10: Inventory (4/4 plans) — completed 2026-03-14
- [x] Phase 11: Billing (8/8 plans) — completed 2026-03-14
- [x] Phase 12: Audit Logs (3/3 plans) — completed 2026-03-14
- [x] Phase 13: Unit Tests (6/6 plans) — completed 2026-03-14
- [x] Phase 14: CI/CD (5/5 plans) — completed 2026-03-14
- [x] Phase 15: Structured Logging (4/4 plans) — completed 2026-03-14
- [x] Phase 16: Pagination (5/5 plans) — completed 2026-03-14
- [x] Phase 17: IT Help Desk (8/8 plans) — completed 2026-03-14
- [x] Phase 18: Athletics (7/7 plans) — completed 2026-03-14

</details>

<details>
<summary>✅ v3.0 Events Are the Product (Phases 19-22) — SHIPPED 2026-03-16</summary>

- [x] Phase 19: Event Foundation (6/6 plans) — completed 2026-03-15
- [x] Phase 20: Registration and Public Pages (7/7 plans) — completed 2026-03-15
- [x] Phase 21: Documents, Groups, Communication, and Day-Of Tools (10/10 plans) — completed 2026-03-16
- [x] Phase 22: AI, Budget, Notifications, and External Integrations (11/11 plans) — completed 2026-03-16

</details>

### v4.0 Messaging (Phases 23-29)

**Milestone Goal:** Build a Slack-like staff communication system tightly integrated with Lionheart's tickets, events, schools, and teams — powered by Supabase Realtime.

- [x] **Phase 23: Schema, Permissions, and RLS Foundation** — All messaging data models, org-scoped Prisma registration, RLS policies, and permission seeds (completed 2026-05-07)
- [x] **Phase 24: Core Messaging API** — Channel and message CRUD routes, DM routes, search endpoint, and service layer (completed 2026-05-07)
- [x] **Phase 25: Realtime Bridge and JWT Integration** — Supabase Realtime singleton with custom JWT, Postgres broadcast trigger, and cross-org isolation validation (completed 2026-05-07)
- [x] **Phase 26: Core Messaging UI** — Full messaging page with channel list, message area, composer, and sidebar nav item (completed 2026-05-07)
- [x] **Phase 27: Reactions, Threads, Attachments, and Search** — Emoji reactions, thread panel, file uploads, full-text search panel (completed 2026-05-07)
- [ ] **Phase 28: Notifications and Read State** — Unread badges, in-app mention alerts, web push, email digest, per-channel preferences
- [ ] **Phase 29: Auto-Channels, System Bot, and Integrations** — Team and school auto-channels, system bot alerts, source context display

## Phase Details

### Phase 23: Schema, Permissions, and RLS Foundation
**Goal**: The data model, security policies, and permission entries exist so that all subsequent messaging work has a safe, org-isolated foundation to build on
**Depends on**: Phase 22
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06
**Success Criteria** (what must be TRUE):
  1. All 8 messaging Prisma models exist in the schema and migrate cleanly
  2. Org-scoped Prisma client treats messaging models the same as tickets and events (auto-inject, soft-delete)
  3. Messaging permission strings appear in DEFAULT_ROLES and survive a fresh org seed
  4. A token from Org A cannot read or subscribe to Org B's messages at the database layer (RLS verified)
  5. Full-text search tsvector column and GIN index exist on Message; denormalized unread counter exists on ChannelMember
**Plans**: 3 plans
Plans:
- [ ] 23-01-PLAN.md — Schema models, org-scoped registration, messagingEnabled, and db push
- [ ] 23-02-PLAN.md — Messaging permission constants and DEFAULT_ROLES mappings
- [ ] 23-03-PLAN.md — RLS policies, unread counter triggers, and tsvector search

### Phase 24: Core Messaging API
**Goal**: Every channel and message operation has a working, permissioned REST API that can be smoke-tested independently before any UI or Realtime code touches it
**Depends on**: Phase 23
**Requirements**: CHAN-01, CHAN-02, CHAN-03, CHAN-04, CHAN-05, CHAN-06, CHAN-07, MSG-01, MSG-02, MSG-03, MSG-07, SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. User can create, rename, archive, and manage membership for public and private channels via API
  2. User can start a 1:1 DM and a group DM via API
  3. User can send, edit, soft-delete, and @mention via API
  4. Message search returns results scoped strictly to the requesting user's org and accessible channels
**Plans**: 4 plans
Plans:
- [ ] 24-01-PLAN.md — Channel service layer + middleware messagingEnabled gate
- [ ] 24-02-PLAN.md — Message service layer (send, edit, delete, pagination, search)
- [ ] 24-03-PLAN.md — Channel and DM API routes
- [ ] 24-04-PLAN.md — Message and search API routes
**UI hint**: yes

### Phase 25: Realtime Bridge and JWT Integration
**Goal**: The custom HS256 JWT works with Supabase Realtime's accessToken option, Postgres broadcasts messages to subscribers without per-subscriber RLS queries, and a cross-org isolation test passes
**Depends on**: Phase 24
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05
**Success Criteria** (what must be TRUE):
  1. A message written via Prisma appears on all subscribed clients in the same channel within 1 second, without a page refresh
  2. The browser's Supabase Realtime client authenticates using the custom JWT retrieved from /api/auth/token (not the httpOnly cookie)
  3. A client subscribed to Org A's channel does not receive Org B's messages
  4. Typing indicators and presence status (online/away/offline) update in real time for all channel members
  5. The Postgres broadcast trigger fires on Message INSERT using realtime.send(), not Postgres Changes
**Plans**: 2 plans
Plans:
- [ ] 25-01-PLAN.md — Token endpoint + broadcast trigger SQL
- [ ] 25-02-PLAN.md — RealtimeProvider context + useRealtimeChannel hook

### Phase 26: Core Messaging UI
**Goal**: Staff can open a messaging page, see their channels, send and receive messages in real time, and reach messaging from the sidebar — with nothing requiring a page refresh
**Depends on**: Phase 25
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Messaging page renders with a ~280px channel list on the left and a full-height message area on the right, matching the glassmorphism design system
  2. Message list uses virtual scroll — loading 500 older messages does not degrade scroll performance
  3. Composer accepts markdown, emoji, file uploads, and @mention autocomplete in a single input
  4. The sidebar shows a "Messaging" nav item with an unread badge; the item is hidden when messagingEnabled is false
  5. On mobile, the channel list collapses to an overlay; message area fills the screen
**Plans**: 4 plans
Plans:
- [ ] 26-01-PLAN.md — Sidebar nav item, messaging page shell, and channel list
- [ ] 26-02-PLAN.md — Virtual-scrolled message list with realtime integration
- [ ] 26-03-PLAN.md — Composer with emoji, @mentions, and send
- [ ] 26-04-PLAN.md — Thread panel and mobile responsive layout
**UI hint**: yes

### Phase 27: Reactions, Threads, Attachments, and Search
**Goal**: The messaging experience is feature-complete at launch bar — staff can react, reply in threads, attach files, search history, pin messages, and mute channels
**Depends on**: Phase 26
**Requirements**: MSG-04, MSG-05, MSG-06, MSG-08
**Success Criteria** (what must be TRUE):
  1. User can click a reaction button and add/remove an emoji reaction; reaction counts update in real time
  2. User can open a thread panel from any message and reply without disrupting the main channel view
  3. User can attach an image or PDF and see an inline preview in the message; 25MB limit is enforced
  4. User can search for a keyword and get results showing channel, sender, and date, scoped to their accessible channels
**Plans**: 3 plans
Plans:
- [ ] 27-01-PLAN.md — Reactions API + UI, pin messages, channel mute
- [ ] 27-02-PLAN.md — File attachments (upload, preview, composer wiring)
- [ ] 27-03-PLAN.md — Search UI panel + end-to-end human verification
**UI hint**: yes

### Phase 28: Notifications and Read State
**Goal**: Staff are notified of relevant messages through their preferred channel — in-app badge, push, or email digest — and unread state is accurate across sessions
**Depends on**: Phase 27
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):
  1. Channel unread badge in the sidebar shows the correct count and clears when the channel is opened
  2. An @mention or new DM triggers an in-app notification in real time
  3. A web push notification arrives on a closed browser tab when a DM or @mention is received (VAPID via existing PWA service worker)
  4. A batched email digest of unread messages is sent via Resend at the user's configured frequency
  5. User can set each channel to "all messages", "mentions only", or "none", and toggle email digest on/off
**Plans**: TBD

### Phase 29: Auto-Channels, System Bot, and Integrations
**Goal**: Messaging is woven into the rest of Lionheart — teams and schools get their own channels automatically, and the system bot keeps channels informed of ticket and event activity
**Depends on**: Phase 28
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. Each Team has an auto-created channel; adding or removing a team member syncs their channel membership
  2. Each School in a multi-school org has an auto-created staff channel; membership tracks school assignment
  3. The system bot posts a message when a ticket changes status, an event is approved, or a maintenance alert fires
  4. Auto-channel headers display source context ("Team: IT Support") with a link back to the source entity
**Plans**: TBD

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 21/21 | Complete | 2026-03-06 |
| 8-18 | v2.0 | 57/57 | Complete | 2026-03-14 |
| 19. Event Foundation | v3.0 | 6/6 | Complete | 2026-03-15 |
| 20. Registration and Public Pages | v3.0 | 7/7 | Complete | 2026-03-15 |
| 21. Documents, Groups, Communication, Day-Of | v3.0 | 10/10 | Complete | 2026-03-16 |
| 22. AI, Budget, Notifications, Integrations | v3.0 | 11/11 | Complete | 2026-03-16 |
| 23. Schema, Permissions, and RLS Foundation | v4.0 | 3/3 | Complete | 2026-05-07 |
| 24. Core Messaging API | v4.0 | 4/4 | Complete | 2026-05-07 |
| 25. Realtime Bridge and JWT Integration | v4.0 | 2/2 | Complete | 2026-05-07 |
| 26. Core Messaging UI | v4.0 | 4/4 | Complete | 2026-05-07 |
| 27. Reactions, Threads, Attachments, and Search | v4.0 | 3/3 | Complete | 2026-05-07 |
| 28. Notifications and Read State | v4.0 | 0/TBD | Not started | - |
| 29. Auto-Channels, System Bot, and Integrations | v4.0 | 0/TBD | Not started | - |

**Total: 29 phases, 7 v4.0 phases planned**

---
*For full phase details of shipped milestones, see `.planning/milestones/v[X.Y]-ROADMAP.md` archives.*
