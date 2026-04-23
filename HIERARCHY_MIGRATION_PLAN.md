# Hierarchy Migration Plan — Lionheart Platform

**Author:** Cowork handoff audit, 2026-04-20
**Status:** Draft for review — DO NOT execute without owner sign-off
**Scope:** Restructure the Org/Campus/School/Building/Room hierarchy to support multi-school orgs (Springs charters, districts) and introduce Programs as cross-cutting entities.

---

## TL;DR

The handoff from the previous conversation is directionally correct but materially incomplete. Before any migration, three facts need to be acknowledged:

1. **The `BuildingSchool` / `AreaSchool` junction tables are already live.** The previous conversation treated the migration as greenfield. It isn't. The "empty array = shared with all schools" M:N pattern is wired into PATCH/POST routes for buildings and areas, rendered by `SchoolAccessSelector.tsx`, and exposed in the Campus settings UI. This is prior art that *already solves* the multi-school shared-facility problem. Do not replace it — extend it.

2. **`canAtCampus()` does not exist.** The handoff's core permission insight ("generalize `canAtCampus` → `canAt(user, nodeId)`") is based on a helper that isn't in the codebase. The real system uses `can(userId, permission)`, `canAll()`, `canAccessResource(userId, permission, ownerId, teamIds)`, and `assertCan()`. The work is to add hierarchy-scope awareness to `canAccessResource`, not to generalize a helper that doesn't exist.

3. **Blast radius is ~196 files, 1,559+ occurrences, 67 API endpoints, and 34 TanStack Query definitions.** The handoff implied the change was narrow. It is not narrow. Every maintenance ticket, IT ticket, calendar event, event project, asset, device, and approval rule has direct FKs to `campusId`, `schoolId`, `buildingId`, `areaId`, or `roomId`.

These three facts together mean the "rename-swap" framing needs revision. What follows is a concrete plan with three viable shapes and a recommendation.

---

## Current State (verified against schema + code)

### Facilities hierarchy (current)

```
Organization
  └── Campus           (org-scoped, soft-delete, @@unique[orgId, name])
        ├── School     (School.campusId nullable → points UP to Campus)
        ├── Building   (campusId + schoolId both nullable)
        │     └── Room (buildingId required, areaId nullable — orphan path)
        └── Area       (campusId + buildingId both nullable)
              └── Room (via areaId)

Junction tables (LIVE, already in use):
  BuildingSchool  (buildingId, schoolId)  — empty set = shared with all schools
  AreaSchool      (areaId, schoolId)       — same semantics
```

Key confirmations:

- School → Campus is inverted relative to the target model. The handoff got this right.
- No `District`, `Program`, or `ReportingEntity` models exist. Greenfield.
- The `SchoolType` enum already has a `MULTI_SCHOOL_CAMPUS` value — the schema anticipated this.
- `Room.areaId` is nullable, so rooms can attach directly to a Building. Migration must handle.
- `AuditLog` has `organizationId` but no `deletedAt` — inconsistent, minor, fix incidentally.

### Models with direct hierarchy FKs (the blast radius)

| Model | campusId | schoolId | buildingId | areaId | roomId |
|---|---|---|---|---|---|
| Ticket | ✓ | ✓ | | | |
| MaintenanceTicket | | ✓ | ✓ | ✓ | ✓ |
| MaintenanceAsset | | ✓ | ✓ | ✓ | ✓ |
| PmSchedule | | ✓ | ✓ | ✓ | ✓ |
| ITTicket | | ✓ | ✓ | | ✓ |
| ITDevice | | ✓ | ✓ | | ✓ |
| Calendar | ✓ | ✓ | | | |
| CalendarEvent | | ✓ | ✓ | ✓ | |
| EventProject | ✓ | ✓ | | | |
| ApprovalRule | ✓ | ✓ | | | |
| FormQrCode | | | ✓ | ✓ | ✓ |
| EventSeries | ✓ | | ✓ | | ✓ |
| User | | ✓ | | | |
| Student | | ✓ | | | |
| UserCampusAssignment | ✓ | | | | |
| UserRoomAssignment | | | | | ✓ |

### Permission system (verified)

- Global `Permission` lookup (`resource:action:scope` strings); not org-scoped.
- `Role` is org-scoped. `RolePermission` junction links the two.
- `UserPermission` provides per-user override.
- Helpers in `src/lib/auth/permissions.ts`: `can`, `canAll`, `canAny`, `canAccessResource(userId, permission, ownerId, teamIds)`, `assertCan`, `getUserTeams`, `isOnTeam`.
- No hierarchy-aware scope anywhere. `canAccessResource`'s scope check is team-based, not node-based.
- 30-second per-user permission cache.

### Onboarding flow (verified from ONBOARDING_* docs)

- `POST /api/organizations/signup` takes org-level fields only (no hierarchy).
- Finalization creates a single default Building named `"Main Campus"` (code: `MAIN`) if an address is supplied. It does **not** create a Campus or School row — the Building is created directly under the Org.
- Implication: orgs created via the onboarding flow likely have a Building row with no Campus/School parent. DB audit needed.

---

## Reconciliation with the Handoff

| Handoff claim | Reality | Impact |
|---|---|---|
| Campus/School semantics are inverted | ✓ True | Migration shape is correct in spirit |
| No District/Program/ReportingEntity exist | ✓ True | Greenfield additions |
| Generalize `canAtCampus` → `canAt(user, nodeId)` | ✗ `canAtCampus` does not exist | Real work: extend `canAccessResource` with optional node scope, or add a parallel `canAtNode` helper |
| 8 Springs charters share a District | ⚠ Unverified in code | Need DB audit to confirm |
| Rename-swap migration is "nearly trivial if 95% of Campuses have 1 School" | ⚠ Understates scope | 196 files and live M:N junction tables mean rename-swap is not simple |
| Closure table for nodes | ✓ Good idea, not yet built | Still a recommendation |
| 7 onboarding spec docs exist | ✓ True, all at repo root | They describe only the signup-time flow, not the full facilities system which is managed in Settings → Campus |

---

## Target State — Three Viable Shapes

Pick one. Each has different cost and different upside.

### Option A — Additive: Keep Campus/School names; add District above; promote the junction

**Shape:**
```
Org
  └── District (new — optional, auto-created when Org has >1 School)
        └── School (make School the primary unit; promote today's BuildingSchool/AreaSchool pattern)
              └── Campus (keep as a site label; a School can have N Campuses via new junction)
                    └── Building → Area → Room
Programs (orthogonal M:N to School)
ReportingEntity (separate versioned model)
```

**Pros:** Minimal rename pain. Existing `canAccessResource` gains an optional `scopeNodeId`. Leverages live `BuildingSchool`/`AreaSchool`.
**Cons:** Semantic ambiguity persists — "Campus" still means something different from how districts use the word. Conceptual debt.
**Cost:** 2–3 weeks at steady pace.

### Option B — Rename-swap (the handoff's original)

**Shape:**
```
Org → District → School → Campus → Building → Room
```
Requires renaming the current `Campus` model to something like `SchoolGroup` (or dropping it) and renaming `School` → `Campus` semantically. Plus backfilling `District` and reversing the FK direction on ~8 satellite models.

**Pros:** Clean semantic end state that matches how districts talk.
**Cons:** Every FK on every satellite model has to move. 34 TanStack Queries, 67 API routes, and 196 files touch these names. Live `BuildingSchool`/`AreaSchool` junction complicates the swap.
**Cost:** 6–8 weeks with dual-write discipline. High risk without automated tests.

### Option C — Generic node graph with closure table

**Shape:**
```
OrgNode (id, orgId, kind: DISTRICT|SCHOOL|CAMPUS|BUILDING|AREA|ROOM, parentId, name, metadataJson)
OrgNodeClosure (ancestorId, descendantId, depth)
Program (id, orgId, name) — M:N to OrgNode
ReportingEntity (id, orgId, versionedOrgNodeSnapshot)
```
Every satellite model (`Ticket`, `Asset`, `Calendar`, etc.) gets a single `locationNodeId` FK instead of five.

**Pros:** Infinitely flexible. `canAt(user, nodeId)` becomes trivial via closure table. Matches Ed-Fi abstract-entity pattern.
**Cons:** Massive refactor. Every query, every UI, every Zod schema, every form changes. Polymorphic joins are harder to reason about.
**Cost:** 10–14 weeks. Only worth it if Lionheart will sell to complex multi-tier districts long-term.

### Recommendation

**Option A** unless there's a compelling product reason to commit to B or C now. Rationale:

- You're in staging, but the product has real customers (Linfield, Springs) with data.
- The live `BuildingSchool`/`AreaSchool` pattern is 80% of what you need for shared-facilities. Don't throw it out.
- Adding `District` as optional-above-School is a clean additive change with zero FK inversions on satellite models.
- The `Program` orthogonal entity can piggyback on the same M:N pattern as `BuildingSchool`.
- You can always upgrade to Option B or C later once the org-shape stabilizes.

---

## Migration Phases (Option A)

### Phase 0 — DB audit & decision

Run these queries against staging (see [Appendix A](#appendix-a--db-audit-queries)) and share results. Gates whether we proceed.

### Phase 1 — Schema expand (additive, no breaking changes)

- Add `District` model (orgId, name, code, deletedAt; @@unique[orgId, name]).
- Add `Program` model (orgId, name, code, deletedAt; @@unique[orgId, name]).
- Add `ProgramSchool` junction (same shape as `BuildingSchool`).
- Add `ReportingEntity` model with `{ orgId, name, validFrom, validTo, nodeSnapshot Json }`.
- Add `School.districtId` (nullable FK).
- Add `SchoolCampus` junction (if we want Schools to have multiple Campuses — the flip of today's School.campusId).
- Extend `canAccessResource` signature with optional `scopeNodeId` param; short-circuit if null (preserves all current behavior).

**No data migration yet.** Ship this as a pure-additive PR. `db push` works; no rename, no drop.

### Phase 2 — Backfill & dual-write

- Seed: for each Org, create a default `District` named after the org; wire existing Schools to it.
- Dual-write: new code paths write `districtId` on School; old code paths keep working because FK is nullable.
- Services updated in this order: `campusService.ts`, `schoolService.ts`, then downstream consumers.

### Phase 3 — API surface expansion

- `POST /api/organizations/signup` accepts optional `district`, `schools[]` arrays; falls back to single-school default if omitted (preserves current onboarding).
- New endpoints: `/api/settings/districts`, `/api/settings/programs`, `/api/settings/reporting-entities`.
- Existing `campus`/`school` endpoints unchanged.

### Phase 4 — UI additions

- New Settings tabs: Districts, Programs, Reporting Entities.
- Settings → Campus tab unchanged for now; add District filter above School filter when multi-district orgs exist.
- Onboarding flow gets an optional "Do you have multiple schools?" branch that creates District + schools.

### Phase 5 — Permission extension

- Add hierarchy-aware scope to `canAccessResource`:
  ```ts
  canAccessResource(userId, permission, {
    ownerId?, teamIds?, scopeNodeId?, scopeNodeKind?
  })
  ```
- When `scopeNodeId` is supplied, walk user's role-assignment table for any grant at that node or an ancestor node.
- Ancestor walk needs a helper or closure table. For Option A we can use recursive CTE on the fly — acceptable until load demands a closure table.

### Phase 6 — Contract (optional, later)

- If Campus genuinely becomes redundant after Districts land, deprecate it. Don't rush.

---

## File-by-File Impact (Option A)

### New files

- `prisma/schema.prisma` — add 4 models, 2 junctions, 1 FK
- `src/lib/services/districtService.ts`
- `src/lib/services/programService.ts`
- `src/lib/services/reportingEntityService.ts`
- `src/app/api/settings/districts/route.ts` and `[id]/route.ts`
- `src/app/api/settings/programs/route.ts` and `[id]/route.ts`
- `src/components/settings/DistrictsTab.tsx`
- `src/components/settings/ProgramsTab.tsx`

### Files that change

| File | Change |
|---|---|
| `src/lib/permissions.ts` | Add `DISTRICTS_*`, `PROGRAMS_*`, `REPORTING_ENTITIES_*` permission constants |
| `src/lib/auth/permissions.ts` | Extend `canAccessResource` signature with optional node scope |
| `src/lib/services/organizationRegistrationService.ts` | `seedOrgDefaults` creates default District |
| `src/lib/services/schoolService.ts` | Accept optional `districtId` on create/update |
| `src/app/api/organizations/signup/route.ts` | Optional `district`/`schools` payload fields |
| `src/components/settings/SchoolsManagement.tsx` | Show District column when >1 District exists |
| `src/components/settings/CampusTab.tsx` | No change Phase 1; filter additions in Phase 4 |

### Files that do NOT change in Phase 1

All 8+ satellite models (`Ticket`, `MaintenanceTicket`, `Calendar`, etc.) keep their existing `campusId`/`schoolId`/`buildingId`/`areaId`/`roomId` FKs. They do not need to change because Option A is additive.

---

## Risks

1. **Onboarding orphans.** Orgs created via onboarding have a `Building` row named "Main Campus" with no Campus/School parent. The `District` backfill script must not assume a Campus exists. Run audit query #4 (below) to count affected orgs.
2. **Permission cache invalidation.** The 30-second cache on `getUserPermissions` is per-user and doesn't know about node scope. When we extend `canAccessResource`, cache key must include the scope node ID or the cache must be bypassed for scoped checks. Low-risk if we add a second function rather than overloading the first.
3. **TanStack Query cache staleness.** 34 query definitions filter by hierarchy IDs. After schema expansion they continue to work, but any UI that newly filters by District needs new query keys. Watch for stale list pages after the first District is created.
4. **Soft-delete cascade.** If a District is soft-deleted, Schools under it do NOT cascade (Prisma soft-delete extension doesn't cascade). Decide policy: block delete if children exist, or orphan them to `null`.
5. **`SchoolType` enum.** `MULTI_SCHOOL_CAMPUS` suggests prior team thinking. Don't remove it without asking; might be referenced in UI.
6. **`ApprovalChannelConfig.campusId` is "dormant" per APPROVAL-SYSTEM-PLAN.md.** Verify in code before Phase 2 that no subtle dead-code paths break when we start populating it.

---

## Appendix A — DB Audit Queries

Run these against staging. Paste results back and we'll size the migration concretely.

```sql
-- 1. Orgs with >1 Campus today (will become multi-District orgs under Option A)
SELECT o.id, o.name, o.slug, COUNT(DISTINCT c.id) AS campus_count
FROM "Organization" o
LEFT JOIN "Campus" c ON c."organizationId" = o.id AND c."deletedAt" IS NULL
GROUP BY o.id, o.name, o.slug
HAVING COUNT(DISTINCT c.id) > 1
ORDER BY campus_count DESC;

-- 2. Campuses with >1 School (the existing multi-school-per-campus customers)
SELECT c.id, c.name, c."organizationId", COUNT(s.id) AS school_count
FROM "Campus" c
LEFT JOIN "School" s ON s."campusId" = c.id AND s."deletedAt" IS NULL
GROUP BY c.id, c.name, c."organizationId"
HAVING COUNT(s.id) > 1
ORDER BY school_count DESC;

-- 3. Junction table usage — are BuildingSchool / AreaSchool actually written to?
SELECT
  (SELECT COUNT(*) FROM "BuildingSchool") AS building_school_links,
  (SELECT COUNT(*) FROM "AreaSchool") AS area_school_links,
  (SELECT COUNT(DISTINCT "buildingId") FROM "BuildingSchool") AS buildings_with_links,
  (SELECT COUNT(DISTINCT "areaId") FROM "AreaSchool") AS areas_with_links;

-- 4. Onboarding orphans — Buildings with no Campus and no School
SELECT b.id, b.name, b.code, b."organizationId", o.name AS org_name
FROM "Building" b
JOIN "Organization" o ON o.id = b."organizationId"
WHERE b."campusId" IS NULL AND b."schoolId" IS NULL AND b."deletedAt" IS NULL;

-- 5. Rooms bypassing Area (orphan path)
SELECT COUNT(*) AS rooms_without_area
FROM "Room"
WHERE "areaId" IS NULL AND "deletedAt" IS NULL;

-- 6. Record counts (baseline)
SELECT
  (SELECT COUNT(*) FROM "Organization") AS orgs,
  (SELECT COUNT(*) FROM "Campus" WHERE "deletedAt" IS NULL) AS campuses,
  (SELECT COUNT(*) FROM "School" WHERE "deletedAt" IS NULL) AS schools,
  (SELECT COUNT(*) FROM "Building" WHERE "deletedAt" IS NULL) AS buildings,
  (SELECT COUNT(*) FROM "Area" WHERE "deletedAt" IS NULL) AS areas,
  (SELECT COUNT(*) FROM "Room" WHERE "deletedAt" IS NULL) AS rooms;

-- 7. Springs charters (sanity check — do the 8 charter schools show up as Schools?)
SELECT s.id, s.name, s."campusId", c.name AS campus_name, o.name AS org_name
FROM "School" s
JOIN "Organization" o ON o.id = s."organizationId"
LEFT JOIN "Campus" c ON c.id = s."campusId"
WHERE o.name ILIKE '%spring%' OR o.slug ILIKE '%spring%'
ORDER BY o.name, s.name;
```

---

## Open Questions for the Owner

1. Which option — A, B, or C? Default recommendation is A.
2. Is Springs currently on staging with real data, or is it hypothetical? Affects migration script urgency.
3. Does Lionheart have automated tests covering the facilities hierarchy? `npm run smoke:campus` exists; not clear if it covers enough.
4. Is there an existing ADR process? If so, this doc should become `docs/adr/XXXX-hierarchy-migration.md` before execution.
5. Who owns the onboarding flow? Phase 3 requires updating signup payload and finalization logic.

---

## Out of Scope (explicitly)

- SSO / Azure AD / Clever / ClassLink roster integrations — will need hierarchy-aware mapping later, not now.
- Stripe billing per-school vs per-org — deferred.
- Cross-org data sharing (multi-tenant-but-shared analytics) — deferred.
- Renaming `Campus` to something else — Option A keeps the name; revisit only if Option B is chosen.
