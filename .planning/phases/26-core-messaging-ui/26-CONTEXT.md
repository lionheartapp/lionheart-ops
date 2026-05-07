# Phase 26: Core Messaging UI - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Full messaging page with channel list, message area, composer, and sidebar nav item. Staff can open messaging, see channels, send/receive messages in real time, with nothing requiring a page refresh. Mobile-responsive layout.

Requirements: UI-01 through UI-06.

</domain>

<decisions>
## Implementation Decisions

### Page Layout (UI-01)
- **D-01:** Two-column layout — ~280px channel list sidebar on the left, message area filling remaining space. Uses glassmorphism design system (ui-glass classes, warm tokens).
- **D-02:** Page route at `/[tenant]/messaging` following the existing tenant layout pattern. New page component at `src/app/[tenant]/messaging/page.tsx`.
- **D-03:** Wrapped in RealtimeProvider from Phase 25 for real-time message delivery.

### Channel List
- **D-04:** Channel list component shows all channels the user is a member of, grouped by type (channels, DMs). Each item shows channel name, last message preview, unread count badge, and timestamp.
- **D-05:** Active channel highlighted with primary accent. Clicking a channel loads messages in the message area without page navigation (client-side state).

### Message List (UI-02)
- **D-06:** Virtual scrolling via react-virtuoso with reverse scroll (newest at bottom). Prepend-on-load for history — scroll up loads older messages via cursor-based pagination from Phase 24 API.
- **D-07:** Each message shows author avatar, name, timestamp, and content. Own messages visually distinguished (right-aligned or subtle background).
- **D-08:** Skeleton loading during initial fetch, matching message bubble layout shape.

### Composer (UI-03)
- **D-09:** Single rich input at the bottom of the message area. Supports: plain text, markdown formatting, emoji picker (button trigger), and @mention autocomplete (triggered by @ character).
- **D-10:** File upload button in composer toolbar — selection only in this phase; actual upload handling deferred to Phase 27 (MSG-08).
- **D-11:** Send on Enter, newline on Shift+Enter. Send button also available for click.

### Thread Panel (UI-04)
- **D-12:** Thread panel slides in from the right (~400px width) when user clicks "Reply in thread" on a message. Shows parent message at top, thread replies below. Uses same virtual scroll pattern.
- **D-13:** Thread panel overlays on desktop (doesn't shrink message area), replaces message area on mobile.

### Sidebar Nav (UI-05)
- **D-14:** "Messaging" nav item added to MainNavContent.tsx sidebar. Shows unread badge (sum of all channel unread counts). Hidden when messagingEnabled is false via TenantModule check.
- **D-15:** Unread badge uses the denormalized ChannelMember.unreadCount from Phase 23. Fetched via a lightweight API endpoint or included in the sidebar data.

### Mobile Responsive (UI-06)
- **D-16:** On screens < 768px, channel list renders as a slide-over overlay (triggered by hamburger/back button). Message area fills the full screen. Thread panel replaces message area entirely.
- **D-17:** Touch-friendly tap targets (min 44px), swipe gestures not required for MVP.

### Claude's Discretion
- Exact Tailwind classes and glassmorphism card styling
- react-virtuoso configuration (overscan, initial scroll position)
- Emoji picker library choice (emoji-mart or similar)
- @mention autocomplete implementation details (debounce, dropdown positioning)
- Loading states and error boundaries
- Keyboard shortcuts beyond Enter/Shift+Enter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — UI-01 through UI-06
- `.planning/ROADMAP.md` §Phase 26 — Success criteria

### Prior Phase Infrastructure
- `.planning/phases/24-core-messaging-api/24-CONTEXT.md` — API route structure, service layer
- `.planning/phases/25-realtime-bridge-and-jwt-integration/25-CONTEXT.md` — RealtimeProvider, useRealtimeChannel hook
- `src/lib/services/channelService.ts` — Channel CRUD + member management
- `src/lib/services/messageService.ts` — Message CRUD + search
- `src/components/messaging/RealtimeProvider.tsx` — Realtime context provider
- `src/lib/hooks/useRealtimeChannel.ts` — Broadcast + typing + presence hook

### Design System
- `src/app/globals.css` — ui-glass classes, warm tokens
- `src/components/sidebar/MainNavContent.tsx` — Where to add Messaging nav item
- `src/components/ui/` — Reusable UI primitives (Input, Button, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- RealtimeProvider + useRealtimeChannel from Phase 25
- channelService + messageService from Phase 24
- ui-glass, ui-glass-hover classes for glassmorphism cards
- Existing sidebar nav pattern in MainNavContent.tsx
- TenantModule check pattern for feature gating

### Established Patterns
- Tenant pages at `src/app/[tenant]/*/page.tsx`
- TanStack Query hooks for data fetching
- Skeleton loading with animate-pulse
- Mobile-responsive with Tailwind breakpoints (md:, lg:)

### Integration Points
- `src/components/sidebar/MainNavContent.tsx` — add Messaging nav item
- `src/app/[tenant]/messaging/page.tsx` — new page
- `src/components/messaging/` — all new messaging UI components

</code_context>

<specifics>
## Specific Ideas

- Channel list should feel like Slack's sidebar — compact, scannable, with clear unread indicators
- Message area should feel conversational — not like a data table
- Composer should be always visible at the bottom, never hidden behind a "click to reply" button
- Virtual scroll must handle the reverse-chronological challenge (newest at bottom, load older on scroll up)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-core-messaging-ui*
*Context gathered: 2026-05-07 via auto-mode*
