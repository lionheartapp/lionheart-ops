# Phase 25: Realtime Bridge and JWT Integration - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

The custom HS256 JWT works with Supabase Realtime's accessToken option, Postgres broadcasts messages to subscribers without per-subscriber RLS queries, and a cross-org isolation test passes. Covers: token endpoint, Realtime provider, broadcast trigger, typing indicators, and presence.

Requirements: RT-01 through RT-05.

</domain>

<decisions>
## Implementation Decisions

### Token Endpoint and JWT Flow
- **D-01:** Reuse existing JWT — GET /api/auth/token reads the httpOnly auth cookie, verifies it with AUTH_SECRET, and returns the same JWT string in the response body. No second signing path. The browser Supabase client passes this token via the `accessToken` realtime param.
- **D-02:** The JWT already contains `organizationId`, `userId`, and `email` claims (camelCase). These match the RLS helper functions `messaging_org_id()` and `messaging_user_id()` created in Phase 23. No claim translation needed.

### Realtime Singleton and Subscription Model
- **D-03:** React context provider pattern — a `RealtimeProvider` component wraps the messaging layout. Creates one Supabase client on mount with the token from /api/auth/token. Passes it down via context. Handles token refresh, reconnection, and cleanup on unmount.
- **D-04:** Hook API — `useRealtimeChannel(channelId)` subscribes to the current channel's broadcast topic and presence. Returns `{ messages, typingUsers, presenceState, isConnected, error }`. Channels subscribe/unsubscribe as the user navigates.

### Broadcast Trigger Design
- **D-05:** Topic naming uses `msg:{orgId}:{channelId}` pattern. Org prefix provides defense-in-depth alongside RLS — a client can only subscribe to topics matching their org even if they guess another channel's ID.
- **D-06:** Postgres trigger on Message INSERT calls `realtime.send()` with the full message object as payload (row_to_json). Clients receive the complete message without a follow-up fetch. Event name: `new_message`.
- **D-07:** Broadcast-from-Database pattern (not Postgres Changes) — avoids N auth queries per subscriber. The trigger fires once per insert; Supabase Realtime fans out to all subscribers on that topic.

### Typing Indicators and Presence
- **D-08:** Channel-scoped presence — each channel subscription includes Supabase Presence for tracking who's in the channel. States: online (active), away (idle 5+ min via client heartbeat), offline (disconnected).
- **D-09:** Typing uses broadcast events (not presence) — ephemeral, no persistence needed. Client sends a `typing` broadcast event with userId and displayName. Receiving clients show "X is typing..." and clear after 3 seconds of no typing events.
- **D-10:** Debounce on sender side — only send typing event every 3 seconds while actively typing, not on every keystroke.

### Claude's Discretion
- Token refresh strategy (polling interval vs on-demand refresh before expiry)
- Reconnection backoff logic for the Realtime client
- How to handle the case where Supabase Realtime rejects the custom JWT (fallback behavior)
- Whether to include author name/avatar in the broadcast payload or let the client resolve from cache
- Exact Supabase client configuration options beyond accessToken

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — RT-01 through RT-05
- `.planning/ROADMAP.md` §Phase 25 — Success criteria and dependency chain

### Phase 23 Foundation (RLS + triggers)
- `.planning/phases/23-schema-permissions-and-rls-foundation/23-CONTEXT.md` — D-03/D-04: RLS approach, D-07: DMs are channels
- `prisma/migrations/messaging_rls_and_triggers.sql` — RLS policies and helper functions (messaging_org_id, messaging_user_id)

### Phase 24 Foundation (API routes)
- `.planning/phases/24-core-messaging-api/24-CONTEXT.md` — D-01/D-02: route structure, D-03: service layer
- `src/lib/services/messageService.ts` — sendMessage function (Prisma write path that trigger fires on)

### Existing Auth Patterns
- `src/lib/auth.ts` — signAuthToken / verifyAuthToken (JWT sign/verify)
- `src/middleware.ts` — JWT verification + cookie reading pattern

### Supabase Configuration
- `.env` / `.env.local` — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verifyAuthToken(token)` in `src/lib/auth.ts` — verifies HS256 JWT, returns claims or null
- Cookie reading pattern in `src/middleware.ts` — reads `auth-token` httpOnly cookie
- `withAuth` wrapper in `src/lib/api/with-auth.ts` — for the /api/auth/token endpoint
- Existing `@supabase/supabase-js` dependency (used for storage) — Realtime client is included

### Established Patterns
- Auth endpoints are under `/api/auth/*` — token endpoint fits here naturally
- React context pattern used by TanStack Query's QueryClientProvider — RealtimeProvider follows same shape
- Custom hooks in `src/lib/hooks/` — useRealtimeChannel would live here

### Integration Points
- `src/lib/auth.ts` — read existing JWT signing to ensure claim compatibility
- `src/middleware.ts` — cookie name and extraction logic
- `prisma/migrations/` — new SQL file for the broadcast trigger
- Supabase project `yvpbnzeycowtvuxiidbj` — Realtime must be enabled, trigger applied via SQL

</code_context>

<specifics>
## Specific Ideas

- The broadcast trigger payload should include `authorId`, `channelId`, `content`, `createdAt` at minimum — enough for the UI to render without a follow-up API call
- Cross-org isolation test: create two orgs, subscribe to each other's channel topic, verify no messages leak
- Token endpoint should be lightweight (no DB query) — just cookie read + JWT verify + return
- RealtimeProvider should gracefully degrade if token fetch fails (show messages via polling fallback)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-realtime-bridge-and-jwt-integration*
*Context gathered: 2026-05-07*
