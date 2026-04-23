# Active-School Consumer Migration Playbook

This is the working guide for adopting the global **active school** viewpoint across the app. It documents the new `useActiveSchool` hook, the `SchoolSelector` sidebar control, the dual-school Game model, and the Dashboard reference consumer.

Read this before modifying a page that deals with tickets, events, athletics, facilities, rooms, inventory, or any resource that could live at one school inside a multi-school org.

---

## 1. Why this exists

The Lionheart platform is multi-tenant at the **organization** level, but a single organization can contain **multiple schools (campuses)** — a district with three schools, a school system with a main and an extension, etc. Until now:

- `useCampusFilter` was the only global filter, but it was coupled to the facilities module (it intersects with the enabled-modules list) and lived at localStorage key `facilities-campus-filter`.
- Pages outside facilities either re-implemented their own filter or ignored the multi-school reality entirely.
- Cross-school records (e.g. an athletics game between two in-org teams) had nowhere to live: the schedule was authored by the "owning" team, and the opponent's school never saw it on its own schedule.

`useActiveSchool` is the app-wide viewpoint hook. The `SchoolSelector` in the Sidebar writes to it. Every client page can read from it.

> **Vocabulary:** treat the selection as a **viewpoint**, not a hard filter. "All Schools" (null) is a roll-up view. A specific school id is the viewer's perspective — cross-school records still appear, rendered from that school's side (e.g. athletics "vs"/"@" flips).

---

## 2. The pieces

| Piece | Location | Purpose |
|---|---|---|
| `useActiveSchool` | `src/lib/hooks/useActiveSchool.ts` | Single source of truth for "what school am I looking at" |
| `SchoolSelector` | `src/components/sidebar/SchoolSelector.tsx` | Sidebar dropdown that writes to the hook |
| Sidebar mount | `src/components/sidebar/MainNavContent.tsx` | Places the selector above search |
| localStorage key | `active-school-id` | Persistence (empty/missing = All Schools) |
| Event | `active-school-changed` | Dispatched on every write, cross-instance resync |
| Reference consumer | `src/app/dashboard/page.tsx` | Canonical pattern to copy |
| Dual-school games | `prisma/schema.prisma` Game + AthleticTeam relations | `GameOwningTeam` / `GameOpponentTeam` |

---

## 3. The adoption pattern (client component)

Every client page that surfaces school-scoped data should adopt this shape. Copy the Dashboard pattern verbatim — adjust only the filter plumbing.

```tsx
'use client'

import { useActiveSchool } from '@/lib/hooks/useActiveSchool'

export default function MyPage() {
  const { activeSchoolId, activeSchool, isMultiSchool } = useActiveSchool()

  // 1) Pass `schoolId` into any fetch that supports it. Only append when
  //    non-null so the "All Schools" view keeps legacy org-wide behavior.
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '10' })
    if (activeSchoolId) params.set('schoolId', activeSchoolId)
    return `/api/things?${params}`
  }, [activeSchoolId])

  // 2) Include `activeSchoolId` in query-key or callback deps so the cache
  //    properly scopes per-school and re-fetches on change.
  const { data } = useQuery({
    queryKey: ['things', activeSchoolId],
    queryFn: () => fetch(url).then((r) => r.json()),
  })

  // 3) (Optional) Surface the current viewpoint in the UI when multi-school,
  //    so users can see what they selected is being respected.
  return (
    <>
      {isMultiSchool && (
        <p className="text-xs text-slate-500">
          Viewing: {activeSchool?.name ?? 'All Schools'}
        </p>
      )}
      {/* ...rest of page */}
    </>
  )
}
```

### What **not** to do

- **Don't** build a second local school-picker. The Sidebar selector is global — any other picker competes with it and confuses users.
- **Don't** read localStorage directly. The hook handles hydration, cross-tab sync, and stale-pointer fallback.
- **Don't** require a non-null `activeSchoolId`. "All Schools" is a first-class view; your page must render coherent data when no school is selected.
- **Don't** store the selection in React state only. Persisting is the whole point — if the user reloads, their viewpoint must survive.

---

## 4. Backend contract — know what your endpoint supports

Before adding `schoolId` to a fetch, verify the endpoint accepts it. Today:

| Endpoint | Accepts `schoolId`? | Notes |
|---|---|---|
| `GET /api/tickets` | Yes | `src/app/api/tickets/route.ts` line ~15 |
| `GET /api/athletics/teams` | Implicit via team.schoolId filter in client | No explicit query param; client filters |
| `GET /api/athletics/games` | Yes (both sides) | `src/app/api/athletics/games/route.ts` — `schoolId` matches owning OR opponent; `asOpponent=false` to restrict |
| `GET /api/events` | Not yet | Filter client-side until server support lands |
| `GET /api/calendar-events` | Not yet | Filter client-side |
| `GET /api/inventory` | Not yet | Filter client-side |
| `GET /api/settings/campus/...` | N/A | These are the source of truth for schools themselves |

If the endpoint doesn't support `schoolId`, filter client-side in a `useMemo` on top of the full fetch. When that becomes too expensive, add `schoolId` support server-side — don't hack around it in the client.

---

## 5. Cross-school records: the athletics precedent

The hardest cases are records that **belong to two schools at once**. Athletics Games are the canonical example and the template you should copy for future dual-ownership models (joint programs, shared events, etc.).

### Data model (see `prisma/schema.prisma`)

```
Game {
  athleticTeamId          String      // owning team (authoritative author)
  opponentAthleticTeamId  String?     // nullable — null = external opponent
  opponentName            String      // always set; from opponent team or free text
  homeAway                String      // always relative to the OWNING team
  homeScore, awayScore    Int?        // absolute — home/away is the key to interpretation
  // ...
  athleticTeam         AthleticTeam  @relation("GameOwningTeam",   fields: [athleticTeamId])
  opponentAthleticTeam AthleticTeam? @relation("GameOpponentTeam", fields: [opponentAthleticTeamId])
}
```

Named relations are **required** when two FKs point at the same model — Prisma won't auto-disambiguate.

### Query shape

Every read uses the shared `GAME_INCLUDE` constant (`src/lib/services/athletics/core.ts`) so both sides are hydrated consistently:

```typescript
const GAME_INCLUDE = {
  athleticTeam:         { select: { id, name, schoolId, sport: { select: { name, color } } } },
  opponentAthleticTeam: { select: { id, name, schoolId, sport: { select: { name, color } } } },
  // ...
}
```

### Viewpoint pattern (UI)

When rendering a Game, resolve a **viewpoint** before touching any display fields. See `resolveGameViewpoint` in `src/components/athletics/ScheduleSection.tsx`:

1. Prefer the explicit team selection (if the user filtered to Team A, render from A's side).
2. Otherwise, if only one side is in the current view (via `displayTeamIds`), render from that side.
3. Flip `homeAway` (HOME ↔ AWAY) and recompute `scoreDisplay` (W/L/T prefix based on which side was home).
4. Swap the opponent label.

That viewpoint object becomes the only thing `GameRow` consumes — the raw `game.homeAway` / `game.opponentName` should never hit render code.

### API filter shape

`GET /api/athletics/games?schoolId=<id>` matches either side by default:

```typescript
// src/lib/services/athletics/core.ts getGames()
if (filters?.schoolId) {
  clauses.push({
    OR: [
      { athleticTeam:         { schoolId: filters.schoolId } },
      { opponentAthleticTeam: { schoolId: filters.schoolId } },
    ],
  })
}
```

Pass `asOpponent=false` in the query string to restrict to owning-team ownership only (e.g. for an admin "games my school authored" report).

---

## 6. Relationship to `useCampusFilter`

They coexist. Short-term rules:

- **Facilities pages** (rooms, buildings, areas, maintenance categorization) keep using `useCampusFilter` — it intersects with the enabled-modules list and has specific behavior there.
- **Everywhere else** use `useActiveSchool`.
- If a page straddles both (e.g. a facilities dashboard that's also a general landing page), use `useActiveSchool` at the page level and let facilities children continue to consume `useCampusFilter`. Don't try to unify them inside the page.

Long-term, when the District → School → Campus hierarchy lands, `useCampusFilter` will be absorbed into `useActiveSchool` (or a successor with the same public API). Write consumers to `useActiveSchool` today and the migration will be mechanical.

---

## 7. Role-based pinning

Users whose role is `member` or `viewer` **and** who were stamped with a `user-school-scope` at login get pinned to their school. The hook does this automatically — you don't need to check roles in your page.

The hook enforces the pin on two layers:

1. **Default** — on first load (or when a scoped user's selection is cleared), the hook writes their school ID to `active-school-id` so every consumer defaults correctly.
2. **Snap-back** — if `activeSchoolId` ever drifts off the pinned school (stale localStorage, rogue `setActiveSchoolId` call, etc.), the hook rewrites it back to their scope. Scoped users cannot view another school's data regardless of what the UI tries to do.

For the UI side, read the `canSwitchSchools` flag from the hook:

- `canSwitchSchools: true` — render an interactive selector (admins, unscoped members).
- `canSwitchSchools: false` — render a read-only badge showing the pinned school. `SchoolSelector` does this by default.

Super-admins and admins have `canSwitchSchools === true` and see "All Schools" as the first option.

---

## 8. Gotchas

**1. Stale pointer fallback.** If a selected school is deactivated or deleted while the user has it picked, the hook clears the selection and broadcasts the change. Your page will simply re-render as "All Schools" — don't assume `activeSchoolId` is permanently stable.

**2. SSR.** `useActiveSchool` is a client-only hook. Don't call it from a server component. For server-rendered pages that need a school-scoped read, re-fetch on the client or pass the selection via URL (and update it from the client hook).

**3. Query-key scoping.** Always include `activeSchoolId` in your TanStack `queryKey` when the result depends on it. Otherwise two schools share a cache entry and swapping schools shows stale data.

**4. Cross-school reads must appear from both sides.** If your data model has dual ownership (athletics is the canonical example), build a viewpoint resolver and render from the side that's in view. A one-sided fetch leaves the other school's schedule empty.

**5. Empty default rendering.** When `activeSchoolId` is null, render the org-wide roll-up — never a "Please select a school" empty state. The [CLAUDE.md UI rules](/CLAUDE.md) forbid empty states that require user action to see data.

---

## 9. Testing checklist (per page adoption)

Before merging a page that adopts `useActiveSchool`:

- [ ] Page renders correctly with no selection (All Schools) — shows all data.
- [ ] Page renders correctly with a specific school selected — shows that school's data plus cross-school records from its viewpoint.
- [ ] Swapping schools via the sidebar selector triggers a refetch (confirm in Network tab — URL should change, query-key should invalidate).
- [ ] Reload persists the selection (localStorage).
- [ ] Open in two tabs, change school in tab A, confirm tab B updates via `storage` event.
- [ ] Scoped-role user (member + user-school-scope stamp) gets pinned, sees a read-only badge (no dropdown), and can't access other schools' data even via direct navigation.
- [ ] Single-school org: selector doesn't render (`isMultiSchool === false`); page reads identically to legacy behavior.
- [ ] `npm run lint` + targeted `tsc --noEmit` pass.
- [ ] Relevant smoke script passes (e.g. `npm run smoke:campus` for facilities pages).

---

## 10. Reference consumer diff (Dashboard)

The Dashboard adoption is the smallest meaningful reference. If you want a concrete starting point, see the changes in `src/app/dashboard/page.tsx`:

1. Added `import { useActiveSchool } from '@/lib/hooks/useActiveSchool'`.
2. Called the hook right after `useAuth()`, destructuring `activeSchoolId`, `activeSchool`, `isMultiSchool`.
3. Appended `&schoolId=...` to the `/api/tickets` URL when non-null inside `fetchTickets`.
4. Added `activeSchoolId` to the `useCallback` deps of `fetchTickets` so it refetches on change.
5. Added a "Viewing: [School]" subtitle under the greeting, conditional on `isMultiSchool`.

Five small edits, no structural change. Copy this pattern.

---

## 11. Migration priority order

Adopt `useActiveSchool` in roughly this order. Earlier pages unblock later ones by exercising the hook across more code paths.

1. **Dashboard** — done (reference).
2. **Athletics (ScheduleSection, Teams, Games)** — done. Viewpoint pattern lives here.
3. **IT Help Desk** (`/it` → `ITDashboard`, `ITKanbanBoard`, `ITTicketsList`) — done. Parent-page hook call + prop-drill; backend already school-aware (`/api/it/tickets`, `/api/it/board`, `/api/it/dashboard`). Heads-up: when scoping a query key by `schoolId`, any optimistic cache write (`setQueryData`) must use the same scoped key — broad `.all` invalidations stay correct, but targeted writes will hit the wrong cache variant otherwise.
4. **Events Hub** (`/events`) — needs `schoolId` server support first (or client-filter).
5. **Inventory** — client-side filter acceptable as interim.
6. **Calendar** — hold off; needs coordinated server work on `/api/calendar-events`.
7. **Settings & admin pages** — usually scoped to org, not school; evaluate case-by-case.

**Lesson from #3 (IT):** before migrating, audit whether the backend already accepts `schoolId` and whether `queryOptions.*` helpers thread it. In many cases the plumbing exists and you're only doing UI prop-drilling. Also check for `queryClient.setQueryData(queryKeys.X.filtered())` — that no-arg call builds a stale key the moment the component starts passing a real schoolId.

---

## 12. Questions to ask when a new page lands on your desk

- Does this resource live at a school? (If yes → use the hook.)
- Can this resource span multiple schools? (If yes → viewpoint pattern, not simple filter.)
- Does the underlying API accept `schoolId`? (If no → client-filter for now, file an issue to add server support.)
- Will a scoped-role user ever see this page? (If yes → confirm `useActiveSchool`'s auto-pin does the right thing.)
- Is there an existing local campus filter on this page? (If yes → migrate to `useActiveSchool` or document why it stays local.)

When in doubt, imagine a district admin who manages three schools. They should be able to open any page, switch schools in the sidebar, and see the corresponding data without a page reload. That's the end state.
