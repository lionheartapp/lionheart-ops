# Phase 27: Reactions, Threads, Attachments, and Search - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Feature-complete messaging experience: emoji reactions (add/remove with real-time counts), file attachments with inline previews (25MB limit via Supabase Storage), pin messages, mute channels, and full-text search UI panel. Threads were partially built in Phase 26 (ThreadPanel exists) — this phase adds the remaining thread UX polish.

Requirements: MSG-04, MSG-05, MSG-06, MSG-08.

</domain>

<decisions>
## Implementation Decisions

### Emoji Reactions (MSG-06)
- **D-01:** Reaction bar appears on message hover — shows a + button to add a reaction. Existing reactions display below the message as pills with emoji + count.
- **D-02:** Click an existing reaction to toggle (add if not reacted, remove if already reacted). Real-time updates via broadcast event `reaction_update` on the channel topic.
- **D-03:** API: POST /api/messaging/messages/[id]/reactions (add) and DELETE /api/messaging/messages/[id]/reactions (remove). Uses MessageReaction table from Phase 23.

### Pin Messages (MSG-04)
- **D-04:** Pin/unpin via message action menu (three-dot menu on hover). Pinned messages show a pin icon. A "Pinned messages" button in channel header opens a list of all pinned messages.
- **D-05:** API: PATCH /api/messaging/messages/[id] with `{ pinnedAt: new Date() }` to pin, `{ pinnedAt: null }` to unpin. GET /api/messaging/channels/[id]/messages?pinned=true for pinned list.

### File Attachments (MSG-08)
- **D-06:** Upload via composer file button (already exists from Phase 26 as placeholder). Files go to Supabase Storage bucket `messaging-attachments` scoped by org. 25MB limit enforced client-side and server-side.
- **D-07:** MessageAttachment row created alongside message. Inline preview for images (thumbnail), PDF shows filename + icon + size. Other files show download link.
- **D-08:** Upload flow: client uploads to Supabase Storage via signed URL, gets back public URL, sends message with attachment URL. API creates both Message and MessageAttachment in one transaction.

### Search UI Panel (uses SRCH-01/SRCH-02 API from Phase 24)
- **D-09:** Search triggered via Cmd+K in messaging page or search icon in header. Opens a search panel (overlay or slide-in). Results show message snippet, channel name, sender, date. Click navigates to message in channel.
- **D-10:** Uses existing GET /api/messaging/search endpoint from Phase 24. No new API needed — just the UI panel.

### Channel Muting (CHAN-07 polish)
- **D-11:** Mute/unmute via channel action menu. Muted channels show dimmed in the channel list. mutedAt timestamp on ChannelMember (already in schema from Phase 23).

### Claude's Discretion
- Reaction picker implementation (inline emoji list vs full picker)
- Search panel styling and animation
- File upload progress indicator
- Pinned messages panel layout
- How to handle upload failures (retry, error toast)

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `.planning/REQUIREMENTS.md` — MSG-04, MSG-05, MSG-06, MSG-08

### Prior Phase Code
- `src/components/messaging/MessageBubble.tsx` — Add reaction bar, pin icon, attachment preview here
- `src/components/messaging/Composer.tsx` — File upload button already exists (placeholder)
- `src/components/messaging/ThreadPanel.tsx` — Already built in Phase 26
- `src/lib/services/messageService.ts` — searchMessages already exists
- `src/app/api/messaging/search/route.ts` — Search endpoint already exists
- `src/lib/services/channelService.ts` — Mute function needed here
- `prisma/schema.prisma` — MessageReaction, MessageAttachment models from Phase 23

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- MessageReaction and MessageAttachment Prisma models (Phase 23)
- searchMessages in messageService.ts (Phase 24)
- GET /api/messaging/search endpoint (Phase 24)
- Supabase Storage service (src/lib/services/storageService.ts)
- EmojiPicker component (Phase 26)
- ThreadPanel component (Phase 26)

### Integration Points
- MessageBubble.tsx — add reactions display, pin icon, attachment preview
- Composer.tsx — wire file upload button to actual upload logic
- New routes: /api/messaging/messages/[id]/reactions, /api/messaging/channels/[id]/pins
- Supabase Storage bucket: messaging-attachments

</code_context>

<specifics>
## Specific Ideas

- Reactions should feel instant (optimistic update) — don't wait for API response
- Search should feel like Slack's search — type, see results, click to jump
- File attachments should show upload progress
- Pinned messages panel should be lightweight — just a scrollable list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-reactions-threads-attachments-and-search*
*Context gathered: 2026-05-07 via auto-mode*
