# Phase 28: Notifications and Read State - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Unread badges, in-app mention alerts, web push notifications, email digest, and per-channel notification preferences. Staff are notified of relevant messages through their preferred channel and unread state is accurate across sessions.

Requirements: NOTIF-01 through NOTIF-05.

</domain>

<decisions>
## Implementation Decisions

### Unread Badges (NOTIF-01)
- **D-01:** Unread count per channel driven by denormalized ChannelMember.unreadCount (Phase 23 trigger). Badge displays in ChannelListItem. Count clears when user opens channel (PATCH lastReadAt on ChannelMember).
- **D-02:** Total unread count in sidebar Messaging nav item is the sum of all channel unread counts (useMessagingUnread hook from Phase 26).
- **D-03:** Mark-as-read API: PATCH /api/messaging/channels/[id]/read — updates lastReadAt on ChannelMember, which triggers the reset_unread_on_read Postgres trigger from Phase 23.

### In-App Mention Alerts (NOTIF-02)
- **D-04:** When a user is @mentioned or receives a new DM, an in-app toast notification appears. Uses the existing Notification model and notification system from v2.0.
- **D-05:** Mention detection reuses MessageMention rows from Phase 24 (parseMentions). After creating mentions, a server-side function creates Notification rows for each mentioned user.
- **D-06:** Real-time delivery: notifications broadcast on a user-specific Supabase Realtime topic `notif:{orgId}:{userId}`. Client subscribes and shows toast.

### Web Push Notifications (NOTIF-03)
- **D-07:** VAPID-based web push extending the existing PWA service worker. PushSubscription model already exists from Phase 23.
- **D-08:** Push sent server-side via web-push npm package when user is offline (no active Realtime connection) and receives a DM or @mention.
- **D-09:** Registration flow: prompt user to enable push on first messaging visit. Store subscription in PushSubscription table.

### Email Digest (NOTIF-04)
- **D-10:** Batched digest sent via Resend (existing email service). Configurable frequency per user: immediate, hourly, daily, or off. Default: daily.
- **D-11:** Digest job runs as a Vercel Cron endpoint (/api/cron/messaging-digest). Queries unread messages since last digest, groups by channel, sends one email per user.

### Per-Channel Preferences (NOTIF-05)
- **D-12:** MessagingNotificationPreference table from Phase 23 stores per-channel settings. Levels: "all" (every message), "mentions" (mentions + DMs only), "none" (silent). Plus emailDigest boolean toggle.
- **D-13:** Preferences UI: dropdown in channel header or channel settings panel. API: PUT /api/messaging/channels/[id]/preferences.

### Claude's Discretion
- Toast notification component styling and positioning
- Web push notification content format (title, body, icon)
- Digest email template design
- Cron job scheduling details
- How to detect "offline" for push (no heartbeat in last N minutes vs no Realtime connection)

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `.planning/REQUIREMENTS.md` — NOTIF-01 through NOTIF-05

### Prior Phase Code
- `src/lib/hooks/useMessagingUnread.ts` — Total unread count hook (Phase 26)
- `src/components/messaging/ChannelListItem.tsx` — Unread badge display (Phase 26)
- `src/lib/services/messageService.ts` — parseMentions creates MessageMention rows (Phase 24)
- `src/components/messaging/RealtimeProvider.tsx` — Realtime client (Phase 25)
- `src/lib/hooks/useRealtimeChannel.ts` — Broadcast subscription (Phase 25)
- `prisma/schema.prisma` — MessagingNotificationPreference, PushSubscription models (Phase 23)
- `src/lib/services/emailService.ts` — Resend email sending
- `src/lib/services/notificationService.ts` — Existing notification creation
- `src/app/api/cron/` — Existing cron endpoint pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Notification model and notificationService.ts from v2.0
- emailService.ts with Resend integration
- Existing cron endpoints in src/app/api/cron/
- PWA service worker (existing)
- ChannelMember.unreadCount with Postgres triggers (Phase 23)

### Integration Points
- ChannelListItem.tsx — mark-as-read on channel open
- messageService.ts sendMessage — trigger notification creation after mention parsing
- New cron endpoint: /api/cron/messaging-digest
- New route: /api/messaging/channels/[id]/read
- New route: /api/messaging/channels/[id]/preferences

</code_context>

<specifics>
## Specific Ideas

- Mark-as-read should fire on channel focus, not just click — handles tab switching
- Push notifications should deep-link to the specific channel
- Digest should be short and scannable — channel name, message count, top 3 message previews

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-notifications-and-read-state*
*Context gathered: 2026-05-07 via auto-mode*
