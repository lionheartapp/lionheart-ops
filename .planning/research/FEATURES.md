# Feature Landscape: Lionheart v4.0 Staff Messaging

**Domain:** Slack-like staff messaging embedded in K-12 school management platform
**Researched:** 2026-05-07
**Sources:** Slack, Pumble, Chanty, Microsoft Teams, Rocket.Chat competitor analysis; K-12 communication tool research (Remind, ParentSquare, SchoolStatus); Supabase Realtime docs

---

## Table Stakes

Features that users in 2026 expect in any team messaging product. Missing any of these and the product feels unfinished.

| Feature | Why Expected | Complexity | Lionheart Dependency |
|---------|--------------|------------|----------------------|
| Public channels | Core organizing unit — channels by topic/team | Low | Team model exists |
| Private channels | For sensitive staff topics, discipline, HR | Low | Role/permission system exists |
| Direct messages (1:1) | Personal async communication | Low | User model exists |
| Group DMs | Ad hoc multi-person threads without creating a channel | Medium | User model exists |
| Message threads | Reply to a specific message without polluting the channel | Medium | None |
| Emoji reactions | Lightweight acknowledgment without a reply | Low | None |
| @mentions (user) | Pull someone's attention into a conversation | Low | Notification system exists |
| @channel / @here | Broadcast to all or active members of a channel | Low | Notification system exists |
| Unread badges | Bold sidebar items + unread count — users won't tolerate missing this | Medium | None |
| Read state tracking | Mark messages as read as you scroll — drives unread badges | Medium | None |
| Edit & delete messages | Everyone expects to fix typos or retract messages | Low | None |
| File attachments | Attach images and documents — used constantly in school contexts | Medium | Supabase Storage already used |
| Image previews | Inline preview of attached images | Low | None |
| Basic full-text search | Find a message you remember sending | Medium | Postgres full-text search (tsvector) |
| Typing indicator | Shows "Alice is typing..." — makes chat feel live | Low | Supabase Realtime Broadcast |
| Presence (online/away) | Green dot — users feel disconnected without it | Medium | Supabase Realtime Presence |
| Mobile-responsive layout | Staff are frequently on phones in hallways | Low | Tailwind already mobile-capable |
| Notification on mention | Push/in-app when @mentioned | Low | In-app notification system exists |
| Mute channel | Silence a noisy channel without leaving it | Low | None |
| Channel member list | See who is in a channel | Low | None |
| Pin messages | Save an important message to the top of a channel | Low | None |

---

## Differentiators

Features that set this apart from generic messaging tools. Not expected by users, but recognized as high value — especially because this is an embedded tool inside a school platform.

| Feature | Value Proposition | Complexity | Lionheart Dependency |
|---------|-------------------|------------|----------------------|
| Auto-channels from tickets | When a maintenance or IT ticket is created, a channel is auto-generated for that job — all discussion lives with the ticket, not in someone's DMs | High | Ticket model, event model |
| Auto-channels from events | Event planning discussions happen in a channel tied to the EventProject hub | High | EventProject model |
| Auto-channels from teams | Each Team in Lionheart gets a messaging channel on first message | Medium | Team model |
| Auto-channels from schools | In multi-school districts, each school gets a staff channel automatically | Medium | School model |
| System bot alerts | When a ticket changes status, a message posts to the ticket's channel automatically ("Ticket #42 moved to IN PROGRESS by John") — replaces email noise | High | Ticket/event lifecycle hooks |
| Lionheart URL previews | Paste a Lionheart event or ticket URL and get a rich card showing title, status, date, assignee — staff stop asking "what's the status?" | High | API routes for events/tickets |
| Context bridge | Open a ticket drawer and see the last 3 channel messages without leaving the ticket | High | Ticket drawer component |
| Slash commands | `/ticket create`, `/event lookup`, `/status update` — power users love this | High | Ticket/event APIs |
| Email digest | Daily or weekly digest of unread messages for staff who don't live in the app | Medium | Resend (emailService) exists |
| Web push notifications | Push to browser even when tab is closed — critical for on-call maintenance staff | Medium | Service worker (PWA exists) |
| Mention from ticket/event | Type @channel from a ticket and it routes to that ticket's auto-channel | Medium | Ticket + messaging integration |

---

## Anti-Features

Things to explicitly not build. Each one is a trap.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Student-facing channels | COPPA risk for under-13. Not the platform's purpose. Zero upside for staff tool | Explicitly scope all channels to staff users only. Document clearly. |
| Parent-facing channels | Parents interact via the magic-link portal and email, not a staff chat tool | Use existing email notification flow for parent comms |
| Video/audio calling | Huge infrastructure cost, Zoom/Meet are already free. Schools won't pay for redundancy | Let users share Google Meet / Zoom links in chat |
| Custom emoji / emoji uploads | Engineering time sink, zero school-specific value | Ship with standard emoji picker only |
| Message scheduling | Very low demand in K-12, significant complexity | Use email digest for async comms |
| Channel templates / cloning | Adds PM overhead with limited payoff at school org sizes | Auto-channels from tickets/events do the job |
| App marketplace / bots API | Slack-level infrastructure. Overkill for single-tenant school tools | Ship system bot only — single purpose, high value |
| Giphy / GIF support | Unprofessional in school context, moderation liability | No |
| Screen sharing / co-browsing | Out of scope, complex, covered by Meet/Teams | No |
| Message retention policies / legal hold | Enterprise feature — schools with compliance needs have IT teams and standalone tools | Soft-delete messages, keep for 1 year, document clearly |
| AI message summarization | High API cost per school, unclear value for small staff teams | Gemini integration can be added later as a paid add-on |
| Unlimited message history on free plan | Pumble does this as a competitive moat — we're monetizing messaging as a paid add-on already | Gate behind messagingEnabled flag, keep 1 year retention |

---

## Feature Dependencies

```
Unread badges → Read state tracking → message delivery timestamps
Threads → Message model with parentMessageId
@mentions → Mention extraction at send time → Notification dispatch
System bot → Ticket/event lifecycle hooks → Bot message creation
Auto-channels → Ticket/Event create/update hooks → Channel upsert logic
Web push → Service worker (already exists in PWA) → Push subscription model
Email digest → Unread state → Resend email batch job (cron)
File attachments → Supabase Storage bucket (messaging-specific)
URL previews → Fetch route metadata from existing API → Preview card component
Slash commands → Message parse layer → Command router → API dispatch
Context bridge (ticket → channel) → Channel lookup by ticketId → Message fetch
```

---

## MVP Definition (ruthlessly minimal)

Ship these and nothing else in the first phase. Users can start communicating; everything else can follow.

**Must have at launch:**

1. Public channels (manually created, org-scoped)
2. Direct messages (1:1)
3. Send, edit, delete messages
4. @user mentions with in-app notification
5. Emoji reactions (standard set, no uploads)
6. Unread badge + read state (mark-as-read on view)
7. File attachments (images and PDFs via Supabase Storage)
8. Typing indicator
9. Basic presence (online / offline)
10. Full-text message search (Postgres tsvector, scoped to org)
11. Mute channel
12. Pin messages

**Defer to Phase 2:**

- Threads (reply-in-thread UX is complex to build right — ship flat first)
- Private channels
- Group DMs
- Auto-channels from tickets/events (requires integration hooks)
- System bot
- Email digest
- Web push
- Slash commands
- URL previews
- Context bridge

**Defer to Phase 3+:**

- Auto-channels from teams/schools (lower urgency than ticket/event)
- Lionheart URL rich previews
- Mention from ticket drawer

---

## Complexity Notes

| Feature | Complexity Rating | Key Risk |
|---------|------------------|----------|
| Channels + DMs | Low-Medium | Schema design — get it right early, hard to migrate |
| Unread / read state | Medium-High | At scale, per-user-per-message state is a lot of rows. Use `last_read_at` cursor pattern, not per-message read flags |
| Threads | High | Two-level message hierarchy + notification routing is where most chat apps introduce bugs |
| Presence | Medium | Supabase Realtime Presence is in-memory — does not survive server restarts, not a source of truth |
| Auto-channels | High | Lifecycle hooks on tickets/events need to be bulletproof. Silent failures would create orphaned channels |
| System bot | High | Needs its own user record, org-scoped, with special bot flag to distinguish from human |
| Web push | Medium | Service worker already exists (PWA) — main work is Push API subscription model and VAPID keys |
| Full-text search | Medium | Postgres tsvector on message body, scoped by channelId, with cursor pagination |
| File attachments | Medium | Already using Supabase Storage — need messaging-specific bucket + size/type limits |
| Slash commands | High | Parser + command router + graceful error handling — easy to do badly |

---

## Competitor Feature Expectations (what users compare against)

**Slack:** Sets the mental model. Users expect channels, DMs, threads, reactions, @mentions, search, and file sharing. Slack's free tier now limits history to 90 days — schools care about this.

**Microsoft Teams:** Common in districts using Microsoft 365. Heavy, slow, confusing UI. Schools use it but complain about complexity. Our advantage: purpose-built for school workflows, not a general enterprise tool bolted onto Office.

**Pumble:** Gaining ground as a Slack alternative. Genuinely free with unlimited history. Sets expectations that staff messaging shouldn't cost extra — this is why the `messagingEnabled` add-on billing needs to be positioned as "bundled school workflows," not "pay for Slack."

**Chanty:** $3/user/month, task management built in. Comparable feature set to Slack. Not education-specific.

**Rocket.Chat:** Open source, used by 700+ schools. Staff complaints: inconsistent pinned messages, poor thread UX, small thread text, search doesn't navigate to message location. Easy wins for Lionheart to beat.

**Remind / ParentSquare:** Parent-to-staff tools, not staff-to-staff. Different use case. Not competitors for this feature.

---

## School-Specific Context

K-12 staff are not knowledge workers. They're in hallways, gyms, and classrooms. Key implications:

- Notifications must be opt-in and low-noise by default. Notification overload (78% of employees overwhelmed) is the top complaint in general messaging tools — school staff are even more disruption-sensitive.
- Channel structure should mirror school org structure (by team, by building, by school) — not require manual setup.
- File sharing is heavily used for: photos of broken equipment, floor maps, event setup diagrams, student permission slips in transit.
- Read receipts on DMs are expected. Group channel read receipts are not expected (too noisy).
- Translation is a nice-to-have for multilingual staff districts but not MVP scope.
