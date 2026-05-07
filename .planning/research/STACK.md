# Technology Stack — v4.0 Messaging

**Project:** Lionheart Platform — Staff Messaging Module
**Researched:** 2026-05-07
**Scope:** New additions only. Existing stack (Next.js 15, Prisma, Supabase, TanStack Query, Framer Motion, Tailwind, Resend, Gemini, Stripe) is validated and unchanged.

---

## New Dependencies Required

### Real-Time Transport

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` | ^2.105.3 (upgrade from ^2.49.1) | Realtime channels, presence, broadcast | The project already has this — needs a version bump. 2.105.x includes transport-level error surfacing for channels. |

Supabase Realtime is the right choice here. It's already part of the infrastructure. The three primitives needed are all supported: **Broadcast** (ephemeral message delivery), **Presence** (who is online/typing), and **Postgres Changes** (for the system bot and audit trail). No new infrastructure required.

**Critical caveat — custom JWT integration.** This project uses its own HS256 JWTs, not Supabase Auth. To use private Realtime channels with RLS, the custom JWT must include `role: "authenticated"` and `sub` (a UUID matching the user's Prisma ID is fine). Call `supabaseClient.realtime.setAuth(customJwt)` after creating the client — this passes the token on WebSocket heartbeats. Without this, private channel RLS checks will fail silently and channels will appear to subscribe but receive nothing.

For server-side broadcasting (system bot, ticket/event alerts), use the REST broadcast API with the service role key — no WebSocket connection needed from the API route.

---

### Web Push Notifications

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `web-push` | ^3.6.7 | Send VAPID push notifications from server | Standard Node.js VAPID library, actively maintained, works in Next.js API routes. No third-party service dependency. |

Browser push requires a service worker to receive notifications when the app is closed. The project already has a service worker for offline PWA. The existing SW should be extended to handle `push` events rather than creating a second SW — two service workers on the same origin will conflict.

VAPID keys (one public, one private) are generated once and stored in env vars. The public key goes to the browser during subscription; the private key stays server-side only.

Do NOT use Firebase Cloud Messaging (FCM) for this. FCM adds a Google dependency and a registration overhead that is unnecessary when the project already controls the server. The native Web Push Protocol (`web-push` package) is sufficient for Chrome, Firefox, and Safari 16.4+.

---

### Messaging UI

**Virtualized message list:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-virtuoso` | ^4.18.6 | Virtual scroll for message lists | The only React virtualization library with a built-in `VirtuosoMessageList` API designed specifically for chat — handles reverse scroll, prepend-on-load (for message history), and auto-scroll-to-bottom natively. Alternatives like `react-window` require significant manual wiring for chat patterns. |

**Emoji picker:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `emoji-picker-react` | ^4.19.1 | Emoji picker popover | Lightweight (no peer deps), actively maintained (last published 8 days ago as of research date), ships its own data, tree-shakeable. `emoji-mart` has more features but requires a separate data fetch and is heavier — overkill for a staff tool where emoji use will be moderate. |

**Markdown rendering:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-markdown` | ^10.1.0 | Render message markdown safely | Does NOT use `dangerouslySetInnerHTML`. Builds a virtual DOM from a syntax tree. Secure by default. |
| `remark-gfm` | ^4.0.1 | GitHub Flavored Markdown plugin | Adds tables, strikethrough, task lists — the subset of formatting staff will actually use in messages. |
| `rehype-sanitize` | ^6.0.0 | Sanitize rendered HTML | Belt-and-suspenders XSS protection on top of react-markdown's inherent safety. Required when users can type arbitrary content. |

Do NOT use a full-featured editor like TipTap or Slate for the message input. A plain `<textarea>` with keyboard shortcuts (bold = `**text**`, etc.) is appropriate for a chat input. Slack itself uses a custom contenteditable, but that complexity is not justified here — a textarea with a markdown preview toggle is sufficient for v4.0.

---

### Full-Text Search

No new library needed. Use PostgreSQL natively.

The approach: add a `tsvector` generated column to the `Message` model via a raw SQL trigger (Prisma cannot manage generated `tsvector` columns directly), create a GIN index on that column, and query via `prisma.$queryRaw` with `to_tsquery` and `ts_rank_cd`.

Prisma's `fullTextSearchPostgres` preview feature does not support `Unsupported("tsvector")` typed fields as of Prisma 6.7.0. Use raw SQL for the FTS queries — this is the established pattern and a 1,000x performance improvement over scanning `TEXT` fields with ILIKE.

Migration pattern:
```sql
-- In a raw migration file
ALTER TABLE "Message" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX message_search_idx ON "Message" USING GIN (search_vector);
```

Query pattern in route handlers:
```typescript
const results = await prisma.$queryRaw`
  SELECT id, content, "channelId", "createdAt"
  FROM "Message"
  WHERE search_vector @@ plainto_tsquery('english', ${query})
    AND "organizationId" = ${orgId}
  ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', ${query})) DESC
  LIMIT 50
`
```

---

## Upgrade Required (Existing Dependency)

| Package | Current | Target | Reason |
|---------|---------|--------|--------|
| `@supabase/supabase-js` | ^2.49.1 | ^2.105.3 | Bug fixes in realtime channel error surfacing; presence fixes that were broken in 2.54–2.55 are resolved in later versions. |

No other existing dependencies need upgrading for this milestone.

---

## What NOT to Add

**Socket.io / Ably / Pusher** — Supabase Realtime is already in the stack and provides broadcast + presence. Adding a second real-time layer is pure overhead.

**Redis / pub-sub infrastructure** — Not needed at this scale. Supabase Realtime's Elixir/Phoenix cluster handles the fan-out. Revisit at 100K+ concurrent connections.

**Stream Chat SDK or Sendbird** — Pre-built chat SDKs bring their own UI, data model, and pricing. They would conflict with the existing org-scoped Prisma data model and the glassmorphism design system. Building on Supabase + Prisma gives full control and keeps messaging data inside the existing database (important for FERPA compliance — no student data to a third-party service).

**Firebase Cloud Messaging** — Adds Google dependency. The `web-push` package handles the same use case without the integration overhead.

**TipTap / Slate / ProseMirror** — Rich text editors are correct for documents. For chat, markdown-in-a-textarea is simpler, more performant, and sufficient. Revisit if threaded formatting becomes a v4.1 requirement.

**Separate Elasticsearch / Algolia** — Postgres full-text search with a GIN index handles the message search volume for a school. An external search service would cost money and require data sync. Postgres FTS is appropriate until message volumes exceed tens of millions per org.

---

## Environment Variables to Add

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY    # VAPID public key (browser-safe, exposed to client)
VAPID_PRIVATE_KEY               # VAPID private key (server only — never expose)
VAPID_EMAIL                     # Contact email for push notification origin (e.g. mailto:ops@lionheartapp.com)
```

VAPID keys are generated once: `npx web-push generate-vapid-keys`

---

## Integration Notes

**Supabase Realtime + custom JWT flow:**
1. After login, the Next.js API sets the httpOnly JWT cookie as usual.
2. The client fetches its own JWT from `/api/auth/me` (or similar) to get the raw token string.
3. Create a `supabase-browser` client (separate from the Prisma path) using the anon key plus `supabaseClient.realtime.setAuth(jwtString)`.
4. The JWT passed to Realtime must include `role: "authenticated"` and `sub: userId` for RLS to work on private channels.
5. RLS policies on `realtime.messages` reference `(current_setting('request.jwt.claims', true)::jsonb ->> 'sub')` to identify the user.

**Service worker consolidation:** The existing PWA service worker (`/sw.js`) handles offline caching. Extend it to handle `push` events — do not register a second SW. Merging push handling into the existing SW avoids registration conflicts.

**TanStack Query + Realtime:** TanStack Query manages cache. When a Supabase Realtime message arrives, call `queryClient.setQueryData` or `queryClient.invalidateQueries` to merge the new message into the existing cache. This is the established pattern and avoids maintaining a parallel state system.

---

## Sources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence)
- [Custom JWT with Supabase Realtime — community discussion](https://github.com/orgs/supabase/discussions/11826)
- [web-push on npm](https://www.npmjs.com/package/web-push) — v3.6.7
- [react-virtuoso](https://virtuoso.dev/) — v4.18.6, VirtuosoMessageList API
- [emoji-picker-react on npm](https://www.npmjs.com/package/emoji-picker-react) — v4.19.1
- [react-markdown](https://remarkjs.github.io/react-markdown/) — v10.1.0
- [Prisma FTS with tsvector](https://medium.com/@chauhananubhav16/bulletproof-full-text-search-fts-in-prisma-with-postgresql-tsvector-without-migration-drift-c421f63aaab3)
- [Supabase js releases](https://github.com/supabase/supabase-js/releases) — v2.105.3
