# Requirements: Lionheart v4.0 Messaging

**Defined:** 2026-05-07
**Core Value:** Staff can communicate in real time within Lionheart — channels, DMs, threads — integrated with the school's teams, events, and daily operations.

## v4.0 Requirements

### Schema & Infrastructure

- [ ] **SCHEMA-01**: All messaging models (Channel, ChannelMember, Message, MessageReaction, MessageAttachment, MessageMention, NotificationPreference, PushSubscription) exist as org-scoped Prisma models with soft-delete
- [ ] **SCHEMA-02**: RLS policies on all messaging tables enforce org isolation via custom JWT claims, tested with two different org tokens
- [ ] **SCHEMA-03**: Messaging permissions (channels:create, channels:manage, channels:moderate, messages:delete:any, dms:send, integrations:manage) seeded into default roles
- [ ] **SCHEMA-04**: Organization model has `messagingEnabled` boolean flag gating all messaging routes and UI
- [ ] **SCHEMA-05**: Denormalized unread count integer on ChannelMember maintained by database trigger
- [ ] **SCHEMA-06**: Full-text search tsvector column on Message with GIN index, populated via Postgres trigger

### Channels

- [ ] **CHAN-01**: User can create a public channel with name, slug, and description
- [ ] **CHAN-02**: User can create a private channel visible only to invited members
- [ ] **CHAN-03**: User can start a 1:1 direct message with any org member
- [ ] **CHAN-04**: User can start a group DM with multiple org members
- [ ] **CHAN-05**: User can rename, archive, or update description of channels they own or admin
- [ ] **CHAN-06**: User can view and manage channel member list (add/remove members, set roles)
- [ ] **CHAN-07**: User can mute a channel to suppress notifications without leaving

### Messages

- [ ] **MSG-01**: User can send a text message with markdown formatting to any channel they belong to
- [ ] **MSG-02**: User can edit their own messages (showing "edited" indicator)
- [ ] **MSG-03**: User can soft-delete their own messages; admins can delete any message
- [ ] **MSG-04**: User can pin a message to the top of a channel
- [ ] **MSG-05**: User can reply to a specific message in a thread panel (flat, one-level deep)
- [ ] **MSG-06**: User can react to any message with a standard emoji
- [ ] **MSG-07**: User can @mention a user, @channel, @here, or @team with autocomplete
- [ ] **MSG-08**: User can attach files (images, PDFs, docs) to a message via Supabase Storage with inline image previews

### Realtime

- [ ] **RT-01**: New messages appear in the channel without page refresh via Supabase Realtime Broadcast
- [ ] **RT-02**: Typing indicator shows "X is typing..." for the active channel
- [ ] **RT-03**: Presence indicators (online/away/offline) display on user avatars in channel member list and DMs
- [ ] **RT-04**: Supabase client uses custom JWT via accessToken option with a server-side token endpoint
- [ ] **RT-05**: Broadcast-from-Database pattern (Postgres trigger → realtime.send) used instead of Postgres Changes

### Notifications

- [ ] **NOTIF-01**: User sees unread badge count per channel in the sidebar, driven by denormalized ChannelMember counter
- [ ] **NOTIF-02**: User receives in-app notification on @mention or new DM in real time
- [ ] **NOTIF-03**: User receives web push notification (VAPID) when browser tab is closed, extending existing PWA service worker
- [ ] **NOTIF-04**: User receives batched email digest of unread messages via Resend (configurable frequency)
- [ ] **NOTIF-05**: User can set per-channel notification level (all messages, mentions only, none) and toggle email digest

### Search

- [ ] **SRCH-01**: User can search messages across all channels they have access to, with results showing channel name, sender, and date
- [ ] **SRCH-02**: Search is scoped to the user's organization via org-scoped Prisma queries on the tsvector index

### Integrations

- [ ] **INT-01**: Each Team in Lionheart has an auto-created messaging channel with membership synced to team roster
- [ ] **INT-02**: Each School in a multi-school org has an auto-created staff channel with membership synced to school assignment
- [ ] **INT-03**: System bot user (with bot flag) posts ticket status changes, event approvals, and maintenance alerts into relevant channels
- [ ] **INT-04**: Auto-channels display source context ("Team: IT Support" or "School: Linfield") and link back to the source entity

### UI

- [ ] **UI-01**: Messaging page with channel list sidebar (~280px) and message area filling remaining space, following glassmorphism design system
- [ ] **UI-02**: Message list uses virtual scrolling (react-virtuoso) with reverse scroll and prepend-on-load for history
- [ ] **UI-03**: Message composer with markdown support, emoji picker, file upload, and @mention autocomplete
- [ ] **UI-04**: Thread panel slides in from the right when replying to a message
- [ ] **UI-05**: Sidebar nav item "Messaging" with unread badge, gated by messagingEnabled via TenantModule
- [ ] **UI-06**: Mobile-responsive layout with channel list as overlay on small screens

## v5.0 Requirements (Deferred)

### Ticket/Event Integration

- **DEFER-01**: Auto-channels from tickets — channel auto-created on first discussion click, archived on close
- **DEFER-02**: Auto-channels from events — planning channel for each EventProject
- **DEFER-03**: Context bridge — last 3 channel messages visible inside ticket/event drawer
- **DEFER-04**: Mention from ticket — @channel routes to ticket's auto-channel

### Power Features

- **DEFER-05**: Slash commands (/ticket create, /event lookup, /oncall)
- **DEFER-06**: Inline rich previews when pasting a Lionheart URL
- **DEFER-07**: Semantic search via pgvector for "find that thing about the gym leak"
- **DEFER-08**: Message export / compliance reports

## Out of Scope

| Feature | Reason |
|---------|--------|
| Student-facing channels | COPPA risk for under-13; messaging is staff-only |
| Parent-facing channels | Parents interact via magic-link portal and email |
| Video/audio calling | Zoom/Meet are free; no upside to building this |
| Custom emoji uploads | Engineering sink, zero school-specific value |
| Giphy / GIF support | Unprofessional in school context, moderation liability |
| Screen sharing | Covered by Meet/Teams |
| AI message summarization | Add later as paid add-on; high API cost per school |
| App marketplace / bots API | Overkill for single-tenant school tools |
| Message scheduling | Very low demand in K-12 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated during roadmap creation) | | |

**Coverage:**
- v4.0 requirements: 37 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 37

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after initial definition*
