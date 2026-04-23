# Facilities Restructure Proposal

**Status:** Draft for review — no code changes until approved
**Date:** 2026-04-21
**Author:** Michael + Claude
**Supersedes:** Current "Campus" settings tab

---

## 1. Problem

The current Settings → **Campus** tab bakes in an assumption that a tenant has one Campus with many Schools inside it. That's backwards for every real-world case we've looked at:

- **Linfield Christian School** — is one *School* that operates at one location with three distinct *Campuses* (Elementary, Middle, High) sharing the same address.
- **Springs Charter Schools** — is one *District* with ~20 *Schools* (learning centers), each with its own address, some of which may eventually have multiple *Campuses*.

The UI also hides the global School Selector when the org has `<= 1 Campus`, which means a 3-school tenant sitting on 1 campus row sees no selector at all. The scoping unit in the hook (`useActiveSchool`) is wired to the campuses API, not a schools API — that's the proximate cause, but the deeper issue is that the data model conflates School and Campus.

---

## 2. Agreed Hierarchy

### 2.1 Primary containment tree

```
Org (tenant, always exactly 1 root)
└─ District (1..n per Org, always at least 1 — auto-created for single-district orgs)
   └─ School (1..n per District)
      └─ Campus (1..n per School)
         └─ Building (1..n — see "Building parent" below)
            ├─ Room  (1..n per Building — indoor, schedulable)
            └─ Space (1..n per Building — non-room: fields, parking, outdoor areas)
```

### 2.2 Cross-cutting entity: Site

A **Site** is a shared physical location — one address + one geocode, referenced by anything that actually sits there. It lets Linfield's three campuses share one address without duplicating it three times and drifting out of sync.

```
Site { id, organizationId, address, city, state, zip, lat, lng, label }

Campus.siteId   — nullable FK → Site  (Campuses at the same site share one Site row)
Building.siteId — nullable FK → Site  (Buildings can reference a Site directly)
```

Editing a Site's address updates everything referencing it in one pass. Unlinking a Campus from a Site snapshots the current address onto the Campus so nothing silently changes.

### 2.3 Building parent (polymorphic)

A Building attaches to **exactly one** of: `districtId`, `schoolId`, or `campusId`. This handles three real shapes:

- **Campus-level** — the common case. Linfield Elementary Campus → Main Hall.
- **School-level** — district-light orgs that don't split into campuses (Springs today: one building per learning center).
- **District-level** — shared district resources: admin offices, maintenance yards, bus barns — sometimes at totally different addresses from any school.

All three FKs are nullable; a Postgres check constraint enforces that exactly one is set.

### 2.4 Address rules

| Entity | Address |
|--------|---------|
| District | No address — logical grouping only |
| School | Optional |
| Campus | Optional — inherits from its Site if bound, else from School |
| Site | **Required** — a Site IS an address + geocode |
| Building | **Required** — a Building is a physical thing and must know where it is. Either directly (`Building.address`) or by reference (`Building.siteId`). |

### 2.5 Concrete tenant models under this hierarchy

**Linfield Christian School (current customer)**

```
Org:      Linfield Christian School
District: Linfield Christian School District     (auto, hidden in UI for single-district orgs)
School:   Linfield Christian School
Campuses: Elementary Campus      — 31950 Pauba Rd, Temecula, CA 92592
          Middle School Campus   — 31950 Pauba Rd, Temecula, CA 92592
          High School Campus     — 31950 Pauba Rd, Temecula, CA 92592
Buildings/Rooms/Spaces: as they exist today, re-parented to the correct campus
```

**Springs Charter Schools (stress test)**

```
Org:      Springs Charter Schools
District: Springs Charter Schools                 (auto)
Schools:  Springs Temecula Valley Student Center
          Springs Hemet Student Center
          Springs Riverside Student Center
          … (~20 total)
Campuses: each school gets 1 default campus it can grow into more if/when it splits
```

---

## 3. Schema Changes

### 3.1 New & Renamed Models

| Model | Status | Notes |
|-------|--------|-------|
| `District` | **New** | `{ id, organizationId, name, slug, isDefault, ...soft-delete }`. No address. |
| `School` | **Renamed** from current `Campus` | Adds `districtId` FK. Keeps `name`, `address` (optional), grade range, etc. |
| `Campus` | **New** (repurposed name) | `{ id, organizationId, schoolId, siteId?, name, address?, ...soft-delete }`. Address optional; inherits from Site → School. |
| `Site` | **New** | `{ id, organizationId, address, city, state, zip, lat, lng, label?, ...soft-delete }`. Shared physical location + geocode. |
| `Building` | **Re-parented (polymorphic)** | `districtId? \| schoolId? \| campusId?` — exactly one set (CHECK constraint). `siteId?` optional. `address` **required** (unless bound to a Site). |
| `Room` | Unchanged | Still under Building |
| `Space` | Unchanged | Still under Building |

### 3.2 Migration Plan (non-destructive)

1. Add new tables `District`, `Site`, and new `Campus`. Add nullable FK columns on `Building`: `districtId`, `schoolId`, `campusId`, `siteId`. Keep the old `Building.schoolId` in place during the transition.
2. For every existing `Campus` row (which is semantically a School):
   - Create a `District` per Org (name = `<OrgName> District`, `isDefault = true`) if one doesn't exist. Link the School to it.
   - Rename the old `Campus` table → `School` in a follow-up step (cleaner: add new tables, dual-write, cut over, drop old).
   - If the School has a non-empty address, create a `Site` from it and set `School.siteId`-analogue (via a default Campus, see next step).
   - Create one default `Campus` row per School (name = "Main Campus"). Link it to the School's Site if one was created. Campus address stays `null` — it inherits from the Site.
   - Re-parent existing Buildings onto the new default Campus (set `Building.campusId`, leave `districtId`/`schoolId` null). Copy the building's current address into `Building.address` if it isn't already set; every Building must have a resolvable address after backfill.
3. Add the Postgres CHECK constraint on Building: `((districtId IS NOT NULL)::int + (schoolId IS NOT NULL)::int + (campusId IS NOT NULL)::int) = 1`.
4. Drop the old `Building.schoolId` column after the app has fully cut over to the new columns.
5. For Linfield specifically, post-migration the user will:
   - Rename "Main Campus" → "Elementary Campus" (keep it on the existing Site).
   - Create "Middle School Campus" and "High School Campus", link both to the same Site (one address, shared geocode).
   - Re-parent the relevant buildings onto the correct campus.

**Key constraint:** we use `db push` (no `_prisma_migrations` table on remote), so this needs to land as a set of `db:push:remote` steps + a data backfill script, not a single `prisma migrate` file.

### 3.3 Org-scope extension

All three new tables go into the `orgScopedModels` list in `src/lib/db/index.ts` and are soft-delete aware.

---

## 4. UI Restructure — Settings Tab

### 4.1 Rename

- Sidebar tab: **Campus** → **Facilities**
  - "Locations" is the alternative; "Facilities" matches the existing `facilities.service.ts` and fits both indoor (rooms) and outdoor (spaces) content.
- Breadcrumb / page title: **Facilities Management**

### 4.2 Layout — Facilities tab

Single scrolling page with a District → School → Campus → Building nested tree. Each level is a collapsible card.

```
┌────────────────────────────────────────────────────────────────────┐
│  Facilities                                     [+ Add School]      │
│                                                                    │
│  [District: Linfield Christian School District] ▼  (hidden header  │
│                                                     when 1 district)│
│                                                                    │
│   ▼ Linfield Christian School                      [Edit] [⋯]      │
│     31950 Pauba Rd, Temecula, CA                                   │
│     3 campuses · 12 buildings · 184 rooms                          │
│                                                                    │
│     ▼ Elementary Campus                            [+ Building]    │
│       ▸ Elementary Main Building         14 rooms · 2 spaces       │
│       ▸ Elementary Gym                   2 rooms  · 1 space        │
│                                                                    │
│     ▸ Middle School Campus               5 buildings · 62 rooms    │
│                                                                    │
│     ▸ High School Campus                 5 buildings · 81 rooms    │
│                                                                    │
│  [+ Add Campus to Linfield Christian School]                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 4.3 Affordances

| Level | Primary actions |
|-------|-----------------|
| District | Rename, add School (only shown when Org has or will have >1 district — otherwise header is hidden and "Add School" floats at the top of the page) |
| School | Edit (name, grade range, address, phone, principal), add Campus, archive/delete |
| Campus | Edit (name, address, notes), add Building, archive/delete |
| Building | Edit, add Room, add Space, archive/delete |
| Room / Space | Edit, archive/delete |

### 4.4 Empty states

- 0 districts: never happens — auto-created on signup.
- 0 schools: big empty card "Add your first school" with CTA.
- 1 school, 0 campuses: we auto-create "Main Campus" so this state also doesn't exist in practice.

---

## 5. Global Selector (Sidebar)

### 5.1 Today

Single-level `SchoolSelector` dropdown, hidden when `campuses.length <= 1`, fed by the campuses API.

### 5.2 Proposed

Two-level selector that collapses to a single level when nothing to choose:

```
┌────────────────────────────────┐
│  🏫  All Schools            ▾  │   ← primary: School (or "All Schools")
├────────────────────────────────┤
│  📍  All Campuses           ▾  │   ← secondary: Campus, only shown when the
└────────────────────────────────┘        active school has >1 campus
```

- **Hidden entirely** when Org has 1 School AND that school has 1 Campus.
- **School-only** when Org has >1 School but every school has 1 Campus (Springs-style).
- **Both** when the active school has multiple campuses (Linfield once split).
- Role-scoped users (member/viewer pinned to a school) get the read-only badge for the School row, with the Campus picker still interactive within their scoped school.

### 5.3 Hook changes

- `useActiveSchool` — switch its data source from `queryOptions.campuses()` to `queryOptions.schools()` (new). Keeps its public contract (`activeSchoolId`, `setActiveSchoolId`, localStorage key `active-school-id`, event `active-school-changed`).
- New `useActiveCampus` — mirrors the pattern, localStorage key `active-campus-id`, event `active-campus-changed`. Returns `null` ("All campuses in this school") by default. Auto-clears when the active school changes.
- New query: `queryOptions.schools()` hitting `/api/settings/schools` (renamed from the current campuses endpoint). Old endpoint kept as a thin alias for one release cycle to avoid breaking deployed clients mid-deploy.

### 5.4 Event & Ticket filter semantics

Current rule: "active school filters by `schoolId` but always surfaces `schoolId: null` (district-wide) records." That rule carries over unchanged and now runs off the School id rather than the Campus id.

Campus filtering is additive: when a Campus is selected, narrow further via `buildingId IN (select id from Building where campusId = ?)` or via an explicit `campusId` field if we add one to the scheduling records (TBD — probably not needed v1).

---

## 6. API Changes

| Endpoint | Change |
|----------|--------|
| `/api/settings/campus/campuses` | Becomes alias for `/api/settings/schools` for one release, then removed. |
| `/api/settings/schools` | Existing — confirm it returns the new model shape `{ id, name, districtId, address, isActive, ... }`. |
| `/api/settings/districts` | **New** — GET, POST, PATCH, DELETE. |
| `/api/settings/campuses` | **New** — replaces the old semantics. GET list by `schoolId`, POST create, PATCH, DELETE. |
| `/api/settings/facilities/buildings` | Re-parent to `campusId`. |

All endpoints retain the standard pattern (`getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`).

---

## 7. Phased Rollout

**Phase 1 — Schema & backfill (no UI change)**
- Ship the new tables and data backfill. Existing UI keeps pointing at the old `Campus` model (now semantically still a School).
- Verify every org has 1 district, 1+ schools, 1 default campus per school, buildings re-parented to a campus.

**Phase 2 — Facilities tab rewrite**
- Ship the new nested UI. Old Campus tab deleted in the same PR.
- Sidebar label flips to "Facilities".

**Phase 3 — Two-level selector**
- Replace `SchoolSelector` with the two-level version. `useActiveCampus` added.
- Consumers (`useEventProjects`, ticket list, etc.) opt in to campus-level scoping where it matters.

**Phase 4 — District UI (Springs-ready)**
- District header becomes visible when `districts.length > 1`. Add "Add District" affordance.
- Right now no tenant needs this — ship it when Springs (or similar) onboards.

---

## 8. Open Questions

Resolved inline (see §2.4 and §4):
- ~~Campus address optional, inherits from Site → School.~~ ✅
- ~~District hidden when Org has 1 district.~~ ✅
- ~~Single-Campus schools collapse the Campus row visually; Buildings appear directly under the School.~~ ✅
- ~~Shared-address campuses link via a `Site` row (one address, one geocode).~~ ✅

Still open:

1. **Ticket model has `schoolId`.** After the rename it still means School (good). Do we also add `campusId`? Proposal: not in v1 — infer from Room → Building → Campus when we need it for filtering.
2. **EventProject has `schoolId`.** Same call — keep it at School, add `campusId` later only if we find we need "Elementary-only events" filtering.
3. **Where does the Site-autocomplete "killer UX" live?** Phase 1 ships the Site entity with a plain address form. Phase 2 adds Google Places + Brandfetch + NCES autocomplete on the Add School / Add Campus flows. Confirm OK to defer the fancy autocomplete to Phase 2.
4. **Naming of non-room outdoor areas.** Current model calls them `Space`. Alternatives: `OutdoorArea`, `Facility`. Staying with `Space` unless you'd rather rename now.

---

## 9. What I need from you before I start coding

1. Sign-off on the **full hierarchy in §2** — primary tree + Site entity + polymorphic Building parent + address rules.
2. Sign-off on the **tab rename** ("Facilities" vs "Locations" — leaning Facilities).
3. Confirm the **Phase 1 scope**: schema + backfill + no UI change. (Phase 2 is the Facilities tab rewrite. Phase 3 is the two-level selector. Phase 4 is the District UI.)
4. Decision on **open question #3** — defer Google Places / Brandfetch / NCES autocomplete to Phase 2?
5. Decision on **open question #4** — keep `Space` as the name for non-room outdoor areas?

Once those are settled, I'll start with the Prisma schema edits + backfill script and show you the migration plan before running it against remote.
