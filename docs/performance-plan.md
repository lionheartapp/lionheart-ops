# Lionheart Performance Architecture Plan

**Status:** Draft — v1
**Last updated:** 2026-04-22
**Owner:** Platform team

---

## Why this exists

The app is slow. Not in a "server is crashing" way — in an "everything feels heavy" way. Skeleton loaders show up when they shouldn't. Navigating between tabs refetches data you just saw. Simple actions feel like they take a beat to respond.

This isn't one bad page or one slow query. It's a set of architectural defaults that made sense early on (get it working fast, fetch on the client, don't worry about caching yet) and now need to evolve. This plan lays out what to change, in what order, and why.

The goal: make the app feel like Linear or Notion — instant on repeat visits, fast on first visits, and responsive to every click.

---

## What "fast" should feel like

A user should experience:

- **Repeat visits feel instant.** Clicking between Dashboard → Settings → Dashboard shows the page immediately, with no skeleton and no spinner.
- **First visits feel fast.** The page paints with real content in under 500ms. Fully interactive under 1 second.
- **Actions feel immediate.** Renaming a campus, toggling a setting, adding a building — the UI updates *right now*, and the server sync happens in the background. If it fails, it gracefully rolls back.
- **Navigation feels prefetched.** Hovering a link starts loading the next page silently. By the time you click, it's already there.
- **Slow things are isolated.** If one section of a page is slow (e.g. the map tiles), it doesn't hold up the rest of the page.

---

## What's actually slow (and why)

The six bottlenecks, in order of how much they're hurting us:

### 1. Client-side data fetching is the default

Every page follows this pattern:

1. Browser receives an empty page shell
2. React mounts
3. `useEffect` fires a fetch to our API
4. API responds with data
5. Page re-renders with real content

Steps 1–3 take 100–400ms before the fetch even starts. Every page pays this tax on every load. Skeleton loaders are the symptom — they're what we show during steps 1–4.

**What huge companies do:** the server fetches the data first and sends the page with data already in it. The user sees real content on the first frame. No skeleton needed.

### 2. No persistent browser cache

When you navigate away from a page and come back, the app refetches the same data from scratch — even if nothing has changed. This is why Settings feels like it "reloads" every time you switch tabs.

**What huge companies do:** a query cache (TanStack Query, SWR, Apollo Cache) keeps responses in memory. Coming back to a page shows the cached data instantly, then optionally revalidates in the background.

### 3. Auth chain runs on every API request

Every call to any protected API route runs this sequence on the server:

1. Middleware verifies the JWT — fast, no DB
2. Route handler calls `getUserContext` — **DB query** to fetch the user
3. Permission check calls `assertCan` — **DB query** (or 30s cache hit) to fetch role + permissions
4. Route *finally* runs the actual business query

That's up to three sequential database round-trips before we start doing the thing you asked for. Every single API call pays this tax.

### 4. Read-mostly endpoints aren't edge-cached

Schools, teams, roles, permissions, branding, campuses — these change maybe once a week. Right now every request for them hits the origin server, runs the auth chain, queries Supabase, and returns. That's 150–300ms for data that could be served from a CDN in 15ms.

### 5. No prefetching

When you hover over the Settings link, nothing happens. When you click it, that's when the fetching starts. Every click pays the full latency cost.

### 6. Mutations wait for the server

Renaming a campus right now: click save → spinner → 300ms later UI updates. It should be: click save → UI updates immediately → server sync happens silently → if it fails, rollback with a toast.

---

## The plan

Six shifts, ordered by a mix of **impact per hour of work** and **dependencies** (some shifts unlock others).

### Shift 1 — Trim the auth chain *(small, high leverage)*

**Problem:** every API call does up to three sequential DB lookups before running the real query.

**Fix:**
- Embed `roleId` and a compact permission list directly in the JWT. It's already signed — we trust it.
- Use an in-memory LRU cache (Node process-local) for user lookups, keyed by `userId`, with a 60s TTL. Invalidate on user update.
- Only fetch the full user record when a route actually needs fields that aren't in the token.

**Impact:** cuts 100–300ms off *every* API call across the entire app.

**Effort:** 1–2 days. Localized to `src/lib/auth.ts`, `src/lib/request-context.ts`, `src/lib/auth/permissions.ts`.

**Risk:** token bloat if permission list is long. Mitigation: store compact scope flags, not full permission strings. Role change requires forcing a token refresh.

---

### Shift 2 — Edge caching for read-mostly endpoints *(small, high leverage)*

**Problem:** data that barely changes is refetched from origin on every request.

**Fix:**
- Add `Cache-Control: s-maxage=60, stale-while-revalidate=300` to GET handlers for:
  - `/api/settings/schools`
  - `/api/settings/teams`
  - `/api/settings/roles`
  - `/api/settings/permissions`
  - `/api/settings/campus/campuses`
  - `/api/settings/schools/[id]`
  - `/api/branding`
- Cache key must include `organizationId` (via the `x-org-id` header or subdomain). No cross-tenant bleed.
- On any write to these resources, issue a targeted cache purge via Vercel's API.

**Impact:** repeat fetches of the same data drop from ~200ms to ~15ms globally.

**Effort:** 2–3 days. Mostly mechanical once the first endpoint is done.

**Risk:** stale data if invalidation is missed on a write path. Mitigation: wrap writes in a helper that always purges.

---

### Shift 3 — TanStack Query for all client fetches *(medium, foundational)*

**Problem:** no persistent in-browser cache. Every page mount = fresh fetch.

**Fix:**
- Already in `package.json`. Stand up a `QueryClientProvider` at the app root if not already mounted.
- Replace every `useEffect + fetch + useState` pattern with `useQuery`. Start with Settings pages (highest click-volume), then Dashboard, then others.
- Centralize query keys in `src/lib/queries/` (e.g. `schoolsKey(orgId)`, `campusesKey(orgId, schoolId)`) so invalidation is consistent.
- Set sensible defaults: `staleTime: 30s`, `gcTime: 5min` for most data, longer for truly static stuff.

**Impact:** second visit to any page is instant. Mutations elsewhere in the app automatically invalidate stale data.

**Effort:** 1–2 weeks, done incrementally. Each migrated page is a self-contained improvement.

**Risk:** cache key mistakes cause stale or cross-contaminated data. Mitigation: key factory pattern + code review discipline.

---

### Shift 4 — Optimistic UI for common mutations *(medium, huge felt improvement)*

**Problem:** every action waits for the server round-trip before anything visually happens.

**Fix:**
- Use TanStack Query's `onMutate` → `onError` → `onSettled` lifecycle.
- Apply to:
  - Rename operations (campus, school, building, room, team, role)
  - Toggle operations (status, permissions, active/inactive)
  - Add operations where the new item doesn't need a server-assigned ID visible immediately
  - Soft delete
- Show a subtle "saving…" indicator for a couple hundred ms, but only if the mutation is still pending past that threshold — most finish before it appears.
- On error: rollback + toast with retry.

**Impact:** the app feels instant for 90% of user actions.

**Effort:** ~2 weeks for full coverage. Can be rolled out mutation-by-mutation.

**Risk:** more code paths to reason about; inconsistent state if rollback is sloppy. Mitigation: wrap the pattern in a reusable `useOptimisticMutation` hook.

---

### Shift 5 — Server-rendered first paint (React Server Components) *(large, single biggest shift)*

**Problem:** first paint shows a skeleton, not data.

**Fix:**
- Convert page-level components in `src/app/` to server components where possible.
- Server components fetch directly from Prisma (no HTTP hop) and render HTML with data.
- Client components (`'use client'`) handle interactivity only.
- Use `Suspense` boundaries to stream slower sections independently — header and nav arrive fast, a heavy map tile can arrive a moment later without blocking the rest.

**Impact:** first visit to any page feels native-fast. No skeleton.

**Effort:** 1–3 weeks, done page-by-page. Start with:
1. Dashboard
2. Settings landing
3. Facilities landing (already simple, good test case)
4. Tickets list
5. Events list

**Risk:** RSC has a learning curve; hydration mismatches are the most common trap. Mitigation: clear convention — server components own data, client components own state. Don't mix.

---

### Shift 6 — Prefetch on hover *(small, ubiquitous polish)*

**Problem:** clicks incur full load latency.

**Fix:**
- Next.js `<Link>` already prefetches the JS bundle. Extend that by prefetching the *data* too.
- On hover over a Settings tab or a school card, call `queryClient.prefetchQuery` with the key the destination page will use.
- On `pointerenter` with a 100ms debounce so we don't thrash on mouse-moves.

**Impact:** by the time most clicks register, the destination data is already in cache.

**Effort:** 1 week across all main nav + drill-in paths.

**Risk:** low. Worst case we prefetch something the user never opens — wasted bandwidth, nothing worse.

---

## Sequenced execution plan

This is what we'd actually do, in order, assuming one person working ~half time.

### Phase A — Foundation *(weeks 1–2)*

1. **Shift 1** — trim auth chain
2. **Shift 2** — edge cache the top six GET endpoints
3. Stand up shared helpers: `useOptimisticMutation` hook, query key factory, cache invalidation helper

**Deliverable:** every API call is 100–300ms faster. Read-mostly endpoints feel snappy. Foundation is in place for Shifts 3–6.

### Phase B — Client cache *(weeks 3–4)*

4. **Shift 3** — TanStack Query migration for Settings + Dashboard (highest-traffic routes)
5. Apply **Shift 6** (prefetch on hover) to Settings nav + school/campus drill-ins

**Deliverable:** repeat visits to Settings and Dashboard are instant. Hover prefetching makes first visits feel instant too.

### Phase C — Instant actions *(weeks 5–6)*

6. **Shift 4** — optimistic UI for renames, toggles, soft deletes across Settings and Facilities
7. Roll Shift 3 out to remaining routes (Tickets, Events, Athletics)

**Deliverable:** mutations feel instant. The app feels "done" for most day-to-day use.

### Phase D — Server-rendered first paint *(weeks 7–10)*

8. **Shift 5** — RSC conversion, page by page, starting with Dashboard and Settings landing
9. Add `Suspense` streaming for independently-slow sections (maps, charts)

**Deliverable:** first visits feel native-fast. Skeleton loaders are gone from the main pages.

---

## How we'll know it worked

Measurable targets, to check before and after each phase:

| Metric | Today (est.) | Target |
|--------|--------------|--------|
| API TTFB (p50) | 200–400ms | <100ms |
| First contentful paint (cold visit) | 800–1500ms | <500ms |
| Time to interactive | 1.5–3s | <1s |
| Skeleton visible time | 400–1000ms | <200ms or zero |
| Mutation perceived latency | 300–600ms | <50ms (optimistic) |

Instrument with:
- Vercel Analytics (already in place if on Vercel)
- A simple `console.time` wrapper in dev for local comparison
- Sentry performance traces (already have `SENTRY_DSN` in env)

---

## Risks & trade-offs

**Complexity goes up.** Optimistic UI + caching = more code paths. Pay this down with shared hooks, code review, and tests on mutation rollback paths.

**Cache invalidation is the hardest part.** Pick one pattern (key factory + write-through invalidation) and enforce it everywhere. Stale data is worse than slow data.

**RSC has a learning curve.** One person on the team should become the go-to for RSC questions. Don't mix server and client concerns in the same component.

**Token bloat from JWT permissions.** Keep the permission payload compact. If it grows past ~2KB, move to a signed role token with permissions loaded from a 5-minute cache server-side.

**Edge caching + multi-tenant.** Every cache key *must* include `organizationId`. Write a lint rule or a helper that enforces it. Cross-tenant cache bleed would be a serious bug.

---

## Non-goals for this plan

- Not switching ORMs (Prisma is fine)
- Not switching databases (Supabase is fine)
- Not adopting a different state library (Zustand/Redux/etc.)
- Not rewriting in a different framework
- Not chasing 60fps animations (separate concern)

---

## Open questions

- Should any endpoints move to the edge runtime (not just edge cache)? Worth measuring after Shift 1.
- Do we want user-facing "saved" confirmations, or trust silent optimistic updates? (UX call, not architecture.)
- Is there a case for a service worker / offline mode? Probably Phase E, if ever.

---

## Next action

If this plan looks right, start with **Shift 1 (auth chain trim)**. It's a day or two of work, measurable impact on *every* API call, and sets up the foundation for everything else. Can start immediately.
