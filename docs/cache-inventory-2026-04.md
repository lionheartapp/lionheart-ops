# Route Cache Inventory — April 2026

Classifies 74 uncached GET endpoints against the process-local route cache in `src/lib/cache/route-cache.ts`.

## Summary

- Total uncached: **74**
- Recommended CACHE-ORG: **16**
- Recommended CACHE-USER: **7**
- Skip (cron / auth-flow / external): **22**
  - SKIP-CRON: 7
  - SKIP-AUTH-FLOW: 11
  - SKIP-EXTERNAL: 4
- Needs discussion (per-resource / platform / public-unauth): **29**
  - PER-RESOURCE-[id]: 6
  - PLATFORM-ADMIN: 17
  - SKIP-PUBLIC-UNAUTH (public, org derived from resource): 6

---

## Clear wins — cache immediately (CACHE-ORG)

All of these return org-wide reference data that is identical for every user in the org. Mutations on the matching POST/PUT/DELETE routes should call `invalidateOrgCache(orgId, '<bucket-root>')`.

| Route | Bucket suggestion | TTL | Notes |
|-------|-------------------|-----|-------|
| `academic/years` | `academic:years` (+ `:school=${schoolId}` suffix when param set) | 300s | Low churn. Invalidate on POST. |
| `academic/terms` | `academic:terms:year=${academicYearId ?? 'all'}` | 300s | Keyed by optional academicYearId. |
| `academic/bell-schedules` | `academic:bell-schedules:school=${schoolId ?? 'all'}` | 300s | Changes rare; invalidate on POST/PUT. |
| `academic/day-schedules` | `academic:day-schedules:${startDate}:${endDate}:${campusId ?? 'all'}` | 60s | Date-range variant — keep default TTL since suffix is unbounded. Acceptable because UI hits only a handful of ranges per session. |
| `academic/special-days` | `academic:special-days:${start ?? 'any'}:${end ?? 'any'}:${schoolId ?? 'all'}:${campusId ?? 'all'}` | 60s | Same reasoning. |
| `calendar-categories` | `calendar:categories:type=${calendarType ?? 'all'}` | 300s | Very low churn. |
| `calendar/people-search` | `people-search:q=${q ?? 'all'}` (only cache the `fetchAll` path, with `q` empty) | 60s | Only the "fetch all active users" variant is worth caching — search queries have unbounded key space. Safe to skip caching when `q` is present. |
| `ai/availability` | `ai:availability` | 300s | Same output for every user in the org. |
| `calendars/[id]/feed` (iCal) | `calendars:feed:${id}:${tokenHash}` via `cached()` helper | 300s | Already sets `Cache-Control: public, max-age=300` — DB work is still expensive. Use `cached()` with a composite key (no orgId in URL; `organizationId` is looked up from calendar row). Feed content only matters for the single token, so key it by id+token. Low priority. |
| `forms/category/[categoryKey]` | `forms:category:${categoryKey}` (org-scoped) | 120s | Per-category form seed; low churn. |
| `forms/qr` | `forms:qr:list` | 60s | List of QR codes for org. |
| `integrations/twilio/config` | `integrations:twilio:config` | 300s | Config rarely changes. |
| `auth/me/campuses` | `user:${userId}:campuses` — actually prefer **CACHE-USER**. See below. | — | Moved to CACHE-USER section. |
| `campus/lookup` | `campus:lookup:tree` | 300s | Buildings + spaces + rooms tree. Very stable. Invalidate on any campus mutation. |
| `calendar-events/external` | `user:${userId}:external-events:${start}:${end}` — **CACHE-USER** | — | Moved to CACHE-USER section. |
| `calendar-events/external/conflicts` | `user:${userId}:external-conflicts:${startsAt}:${endsAt}` — **CACHE-USER** | — | Moved to CACHE-USER section. |
| `calendar/user-schedule` | composite `org:${orgId}:user-schedule:${userId}:${start}:${end}` | 30s | Returns a specific user's events. Callable by any staff viewer, so keep org-wide with target userId in key. Short TTL — calendars change frequently. Flag for discussion if conflicts matter more than freshness. |

**Final CACHE-ORG count: 13 (dropping the three reclassified to CACHE-USER)**

Invalidation touch points to wire up: `academic/*` POST/PUT/DELETE routes; `calendar-categories` POST/PUT/DELETE; `forms/category/[categoryKey]` PUT; `forms/qr` POST/PUT/DELETE; `integrations/twilio/config` POST/DELETE; campus-management routes (already exist under `settings/campus/*`).

---

## Per-user wins (CACHE-USER)

Each of these is keyed by `userId` — the JWT identifies the user and the response is user-specific. Use `cachePerUser`. Mutations call `invalidateUserCache(userId, '<bucket-root>')`.

| Route | Bucket | TTL | Notes |
|-------|--------|-----|-------|
| `auth/me` | `auth:me` | 30s | High-volume: hit on every client hydration. Short TTL because role/team changes should be reflected quickly. Invalidate on login, role change, team-membership change, avatar update. |
| `auth/permissions` | `auth:permissions` | 30s | Called on every app load — permission booleans. TTL matches existing `getUserPermissions` 30s in-memory cache; this adds an extra layer above it so the HTTP round trip is skipped. Invalidate via `clearPermissionCache(userId)` call sites + `invalidateUserCache(userId, 'auth')`. |
| `auth/me/campuses` | `auth:campuses` | 120s | Returns this user's assigned campus (or all if admin). Invalidate on campus assignment change. |
| `auth/passkey/list` | `auth:passkeys` | 60s | User's registered passkeys. Invalidate on passkey register/revoke. |
| `calendar-events/external` | `external-events:${start}:${end}` | 60s | Per-user external (Google/Microsoft) events for a window. Invalidate on external sync completion. |
| `calendar-events/external/conflicts` | `external-conflicts:${startsAt}:${endsAt}` | 60s | Same data source, different shape. |
| `calendar/user-schedule` | *see note* | — | If the viewer is always the same user as the `userId` query param, cache per-user. But the route allows querying another user's schedule, so it is actually cross-user — keep under CACHE-ORG with composite key. |

**Final CACHE-USER count: 6** (drop `user-schedule`, which belongs to CACHE-ORG composite).

---

## Skip entirely

### SKIP-CRON (7) — cron job endpoints, triggered by Vercel Cron; never cache

- `cron/automations`
- `cron/board-report-delivery`
- `cron/calendar-sync`
- `cron/compliance-reminders`
- `cron/event-notifications`
- `cron/maintenance-tasks`
- `cron/trial-reminders`

### SKIP-AUTH-FLOW (11) — OAuth callbacks, token validation, magic link flows; single-use or state-changing

- `auth/set-password/validate` — token validation, changes state on consume
- `auth/verify-email` — email verification, single-use
- `integrations/google-calendar/auth` — generates OAuth URL (contains state/nonce)
- `integrations/google-calendar/callback` — OAuth code exchange
- `integrations/microsoft-calendar/auth` — OAuth URL gen
- `integrations/microsoft-calendar/callback` — OAuth callback
- `integrations/planning-center/auth` — OAuth URL gen
- `integrations/planning-center/callback` — OAuth callback
- `it/magic-links/[token]/validate` — single-use magic link
- `registration/magic-link/validate` — portal magic link validation
- `public/forms/qr/[token]` — token-gated form entry

### SKIP-EXTERNAL (4) — third-party API proxies; freshness / rate-limit considerations

| Route | Note |
|-------|------|
| `weather` | Could cache per-(lat,lng) for 10–15 min via generic `cached()` helper — weather.service likely already does this. Flag for discussion. |
| `places/autocomplete` | Do NOT cache — Google ToS forbids caching Autocomplete responses beyond session, and unbounded `input` would blow the cache. |
| `integrations/google-calendar/calendars` | Hits Google API directly per-user — could cache per-user for 60–120s but low value. Skip. |
| `ai/availability` | Local DB check; already moved to CACHE-ORG. |

---

## Needs discussion (flag for human review)

### PER-RESOURCE-[id] (6)

These need per-id bucket keys. Invalidation on mutation of same resource requires a bucket-name convention like `calendar-event:${id}`. Modest cache-hit expected only if the same detail view is opened repeatedly. Recommend **future work** unless profiling shows heavy repeat access.

| Route | Category | Question |
|-------|----------|----------|
| `calendar-events/[id]` | PER-RESOURCE | High-volume on the calendar grid? If users open event details repeatedly, cache `calendar-event:detail:${id}` at 60s. Must invalidate in PUT/DELETE. |
| `calendar-events/[id]/resources` | PER-RESOURCE | Same. |
| `academic/bell-schedules/[id]` | PER-RESOURCE | Rarely viewed individually; skip unless admin UI polls. |
| `support-tickets/platform/[id]` | PER-RESOURCE | Ticket detail — users re-poll for status. Worth caching at 30s if polling is the pattern. |
| `registration/[id]/portal` | PER-RESOURCE + portal-auth | Parent-portal-only JWT. Could cache per-`${registrationId}:${portalTokenHash}` at 60s. Flag for portal-traffic review. |
| `registration/[id]/groups` / `registration/[id]/announcements` | PER-RESOURCE + public | Public (registrationId is the access credential). Could cache but confirm this with product — the parent portal polls announcements on interval. |

### PLATFORM-ADMIN (17)

Under `/api/platform/*`. Very low volume (handful of internal admins). Caching savings are marginal. Recommend **skip for now** unless profiling shows slow admin dashboards. Per-admin-user caching would be simple (use `cachePerUser` on the `platformAdmin.id`) if needed.

| Route | Category | Question |
|-------|----------|----------|
| `platform/admins` | PLATFORM-ADMIN | Skip — small N. |
| `platform/audit-logs` | PLATFORM-ADMIN | Skip — paginated, query varies. |
| `platform/auth/me` | PLATFORM-ADMIN | Called on admin hydration. Cache 30s via `cached()` keyed by adminId. Low priority. |
| `platform/discount-codes` | PLATFORM-ADMIN | Skip. |
| `platform/discount-codes/[id]/redemptions` | PLATFORM-ADMIN / PER-RESOURCE | Skip. |
| `platform/organizations` | PLATFORM-ADMIN | Paginated + search — unbounded keys. Skip. |
| `platform/organizations/[id]` | PLATFORM-ADMIN | Org detail page. If admin navigates deeply, cache 30s. Flag. |
| `platform/organizations/[id]/modules` | PLATFORM-ADMIN | Skip. |
| `platform/organizations/[id]/users` | PLATFORM-ADMIN | Skip. |
| `platform/payments` | PLATFORM-ADMIN | Skip — financial data, freshness matters. |
| `platform/plans` | PLATFORM-ADMIN | Stable — cache 300s via `cached()` under global key `platform:plans`. Invalidate on plan CRUD. Small win. |
| `platform/stats` | PLATFORM-ADMIN | Aggregates — candidate for `cached()` at 60s under `platform:stats`. Low admin concurrency so marginal. |
| `platform/subscriptions` | PLATFORM-ADMIN | Skip. |
| `platform/support-tickets` | PLATFORM-ADMIN | Skip. |
| `platform/support-tickets/[id]` | PLATFORM-ADMIN / PER-RESOURCE | Skip. |
| (support-tickets/platform — org-side) | (org-scoped, see below) | See note under org-scoped support tickets below. |
| (support-tickets/platform/[id] — org-side) | (org-scoped) | Same. |

Note: `support-tickets/platform` (not under /api/platform/*) is the **org-side** view of platform support tickets — that is org-scoped, page/status filtered. Skip (paginated query) unless the list view is heavily polled; then cache `support-tickets:list:${status ?? 'all'}:${page}:${perPage}` with CACHE-ORG at 30s.

### SKIP-PUBLIC-UNAUTH (6) — public endpoints where org comes from the resource

Caching is possible via the generic `cached()` helper with a composite key built from the public-identifier. Some are already cache-friendly but the tradeoff depends on write-rate.

| Route | Category | Question |
|-------|----------|----------|
| `branding` | SKIP-PUBLIC-UNAUTH | Already a clear win — key by `x-org-subdomain`. Note: `settings/compliance` etc are already cached, and there is likely already an existing `cacheOrgWide` path for branding but keyed to orgId. Here we don't yet have orgId. Use `cached('public:branding:${subdomain}', ...)` at 300s. Low blast radius — invalidate via `invalidateCacheTag('public:branding')` on org update. **Flag: low-hanging fruit.** |
| `organizations/slug-check` | SKIP-PUBLIC-UNAUTH | Debounced client-side — caching server-side is redundant and would hide just-taken slugs. **Skip.** |
| `public/athletics/[slug]` | SKIP-PUBLIC-UNAUTH | Public schedule page — cache `public:athletics:${slug}` at 60–120s. **Flag as win.** |
| `public/athletics/player/[id]` | SKIP-PUBLIC-UNAUTH / PER-RESOURCE | Same — flag. |
| `public/forms/category/[categoryKey]` | SKIP-PUBLIC-UNAUTH | Public form render. Cache by `categoryKey` + subdomain. Flag. |
| `it/devices/lookup` | SKIP-PUBLIC-UNAUTH | QR device scan — cross-tenant. Low volume, don't cache (user expects fresh status). **Skip.** |
| `it/tickets/[id]/status-public` | SKIP-PUBLIC-UNAUTH | Same — ticket status should be fresh. **Skip.** |
| `events/check-in/[registrationId]` | SKIP-PUBLIC-UNAUTH | Participant self-service. Could cache at 30s keyed by registrationId. **Flag.** |
| `events/register/[eventSlug]` | SKIP-PUBLIC-UNAUTH | Registration form config — cache 60s via `public:register:${eventSlug}`. Invalidate on form update. **Flag as win.** |

---

## Implementation priority

1. **Tier 1 (do now)** — straight `cacheOrgWide` wins with obvious invalidation points:
   - `academic/years`, `academic/terms`, `academic/bell-schedules`
   - `calendar-categories`
   - `campus/lookup`
   - `ai/availability`
   - `integrations/twilio/config`
   - `forms/qr`, `forms/category/[categoryKey]`

2. **Tier 2 (do now, per-user)** — `cachePerUser` with mutation invalidation:
   - `auth/me`, `auth/permissions` (highest traffic on hydration)
   - `auth/me/campuses`, `auth/passkey/list`
   - `calendar-events/external`, `calendar-events/external/conflicts`

3. **Tier 3 (public + composite key)** — generic `cached()`:
   - `branding` (`public:branding:${subdomain}`)
   - `public/athletics/[slug]`, `public/athletics/player/[id]`
   - `events/register/[eventSlug]`
   - `calendars/[id]/feed` (if iCal traffic is high)

4. **Tier 4 (flag / future)** — per-resource detail pages and platform-admin routes. Revisit only if profiling shows hot paths.
