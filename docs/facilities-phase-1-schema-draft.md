# Facilities Restructure — Phase 1 Schema Design

**Status:** Decisions locked — ready for Phase 1b execution on approval
**Date:** 2026-04-22
**Author:** Michael + Claude
**Supersedes:** `HIERARCHY_MIGRATION_PLAN.md` Option A path (now superseded by zero-customer decision)
**Approach:** Drop-and-rebuild (no rename-swap, no dual-write, no backfill SQL — zero real customers means we can wipe cleanly)
**Decisions:** All 8 open questions answered (see §6). Three shifts from original recommendations: District gets contact fields + buildings, `GLOBAL` dropped from CampusGradeLevel (use District-level buildings for non-academic locations), AthleticTeam scoped to Campus.

---

## 0. Ontology, stated once

The new meaning of every term in this doc:

| Term | New meaning |
|---|---|
| **District** | Logical grouping of Schools under an Org. Auto-created for single-district orgs. Can have its own address, phone, contact, buildings, and spaces (district office, bus barn, central maintenance yard, etc.). |
| **School** | The **institution** (e.g., "Linfield Christian School"). One Org can have many. Owns a District parent. |
| **Campus** | A **physical sub-location** under a School (e.g., "Elementary Campus", "Middle Campus"). Holds grade-level metadata. |
| **Site** | A shared physical location (one address + one geocode). Campuses (and Buildings) can reference the same `siteId` when they share an address. |
| **Building** | A physical structure. Polymorphic parent: attaches to exactly one of District/School/Campus. Address required (direct or via Site). |
| **Room** | Indoor, schedulable space inside a Building. |
| **Space** | Non-room area (field, parking lot, courtyard, outdoor). Formerly `Area`. |

Linfield under this model:

```
Org:      Linfield Christian School
District: Linfield Christian School District  (auto, hidden when only 1)
School:   Linfield Christian School
Site:     31950 Pauba Rd, Temecula, CA 92592
Campuses: Elementary Campus  → Site (gradeLevel: ELEMENTARY)
          Middle Campus      → Site (gradeLevel: MIDDLE_SCHOOL)
          High Campus        → Site (gradeLevel: HIGH_SCHOOL)
Buildings: parented to the correct Campus
```

---

## 1. Model-by-Model Changes

### 1.1 New models

**District** (new) — first-class location with contact info and its own facilities
```prisma
model District {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  slug           String?
  isDefault      Boolean      @default(false)   // auto-created default for single-district orgs
  // Contact / address (all optional — district may be logical-only)
  address        String?
  city           String?
  state          String?
  zip            String?
  latitude       Float?
  longitude      Float?
  phone          String?
  phoneExt       String?
  email          String?
  contactName    String?      // superintendent / district admin
  contactTitle   String?
  logoUrl        String?
  sortOrder      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  schools        School[]
  buildings      Building[]   // district-level buildings (admin office, bus barn, central maintenance, etc.)
  spaces         Space[]      // district-level outdoor spaces

  @@unique([organizationId, name])
  @@index([organizationId, isDefault])
  @@index([organizationId, deletedAt])
}
```

**Site** (new)
```prisma
model Site {
  id             String       @id @default(cuid())
  organizationId String
  label          String?      // optional display label ("Temecula Main Site")
  address        String
  city           String?
  state          String?
  zip            String?
  latitude       Float?
  longitude      Float?
  placeId        String?      // Google Places ID for de-dup + re-fetch
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  campuses       Campus[]
  buildings      Building[]

  @@index([organizationId])
  @@index([organizationId, deletedAt])
  @@index([organizationId, placeId])
}
```

### 1.2 Renamed / repurposed models

**School** (renamed from current `Campus` — new meaning: institution)
```prisma
model School {
  id               String          @id @default(cuid())
  organizationId   String
  districtId       String          // required — every school has a district (default auto-created)
  name             String
  slug             String?
  institutionType  InstitutionType @default(PRIVATE)  // moved from Organization
  address          String?         // optional — may be entered here if not on a Campus/Site
  latitude         Float?
  longitude        Float?
  principalName    String?
  principalEmail   String?
  principalPhone   String?
  principalPhoneExt String?
  logoUrl          String?         // per-school brand (for multi-school orgs)
  color            String          @default("#3b82f6")
  sortOrder        Int             @default(0)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  deletedAt        DateTime?
  organization     Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  district         District        @relation(fields: [districtId], references: [id], onDelete: Restrict)
  campuses         Campus[]
  buildings        Building[]      // school-level buildings (shared across all its campuses)
  spaces           Space[]         // school-level outdoor spaces
  users            User[]
  // plus all the back-relations from consumer models (see §2)

  @@unique([organizationId, name])
  @@index([organizationId])
  @@index([districtId])
  @@index([organizationId, deletedAt])
}
```

**Campus** (renamed from current `School` — new meaning: physical sub-location)
```prisma
model Campus {
  id             String             @id @default(cuid())
  organizationId String
  schoolId       String             // required — every campus belongs to a school
  siteId         String?            // optional — set when multiple campuses share an address
  name           String
  address        String?            // optional — inherits from Site → School if blank
  latitude       Float?
  longitude      Float?
  gradeLevel     CampusGradeLevel                      // moved from old School — REQUIRED (no GLOBAL; non-academic stuff lives at District level)
  campusKind     CampusKind         @default(CAMPUS)   // renamed from CampusType
  color          String             @default("#3b82f6")
  sortOrder      Int                @default(0)
  isActive       Boolean            @default(true)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  deletedAt      DateTime?
  organization   Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  school         School             @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  site           Site?              @relation(fields: [siteId], references: [id], onDelete: SetNull)
  buildings      Building[]
  spaces         Space[]
  // plus all the back-relations from consumer models (see §2)

  @@unique([organizationId, schoolId, name])
  @@index([organizationId, isActive])
  @@index([schoolId])
  @@index([siteId])
  @@index([organizationId, deletedAt])
}
```

**Space** (renamed from `Area` — no concept change, just rename)
```prisma
model Space {
  id             String       @id @default(cuid())
  organizationId String
  buildingId     String?      // attaches to a building OR directly to a campus
  campusId       String?
  schoolId       String?      // school-level shared space (e.g., shared athletic field)
  districtId     String?      // district-level shared space
  name           String
  spaceType      SpaceType    @default(OTHER)
  latitude       Float?
  longitude      Float?
  polygonCoordinates Json?
  images         Json?
  isActive       Boolean      @default(true)
  sortOrder      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  building       Building?    @relation(fields: [buildingId], references: [id], onDelete: SetNull)
  campus         Campus?      @relation(fields: [campusId], references: [id], onDelete: Restrict)
  school         School?      @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  district       District?    @relation(fields: [districtId], references: [id], onDelete: Restrict)
  rooms          Room[]
  // plus back-relations (see §2)

  // Postgres CHECK: exactly one of (buildingId, campusId, schoolId, districtId) is set
  @@unique([organizationId, buildingId, name])
  @@index([organizationId, isActive])
  @@index([campusId])
  @@index([schoolId])
  @@index([districtId])
  @@index([buildingId])
  @@index([organizationId, deletedAt])
}
```

**Building** (polymorphic parent rewrite)
```prisma
model Building {
  id             String         @id @default(cuid())
  organizationId String
  // Polymorphic parent — exactly one of (districtId, schoolId, campusId) must be set
  districtId     String?
  schoolId       String?
  campusId       String?
  siteId         String?        // optional — set when multiple parents share a location
  name           String
  code           String?
  address        String         // REQUIRED — may be direct or inherited via Site (UI handles that)
  latitude       Float?
  longitude      Float?
  polygonCoordinates Json?
  buildingType   BuildingType   @default(GENERAL)
  images         Json?
  isActive       Boolean        @default(true)
  sortOrder      Int            @default(0)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  district       District?      @relation(fields: [districtId], references: [id], onDelete: Restrict)
  school         School?        @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  campus         Campus?        @relation(fields: [campusId], references: [id], onDelete: Restrict)
  site           Site?          @relation(fields: [siteId], references: [id], onDelete: SetNull)
  rooms          Room[]
  spaces         Space[]
  // plus back-relations (see §2)

  // Postgres CHECK: exactly one of (districtId, schoolId, campusId) is set
  @@unique([organizationId, code])
  @@index([organizationId, isActive])
  @@index([districtId])
  @@index([schoolId])
  @@index([campusId])
  @@index([siteId])
  @@index([organizationId, deletedAt])
}
```

**Room** (essentially unchanged — drops `areaId`, gains `spaceId` which is the same thing)
```prisma
model Room {
  id             String       @id @default(cuid())
  organizationId String
  buildingId     String
  spaceId        String?      // renamed from areaId; still optional
  roomNumber     String
  displayName    String?
  floor          String?
  images         Json?
  isActive       Boolean      @default(true)
  sortOrder      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  building       Building     @relation(fields: [buildingId], references: [id], onDelete: Restrict)
  space          Space?       @relation(fields: [spaceId], references: [id], onDelete: SetNull)
  // plus existing back-relations (UserRoomAssignment, etc.)

  @@unique([organizationId, buildingId, roomNumber])
  @@index([organizationId, isActive])
  @@index([buildingId])
  @@index([spaceId])
  @@index([organizationId, deletedAt])
}
```

### 1.3 Dropped models

- `BuildingSchool` junction — **dropped** (polymorphic Building parent replaces it)
- `AreaSchool` junction — **dropped** (polymorphic Space parent replaces it)
- `UserCampusAssignment` — **renamed** to `UserSchoolAssignment` (user pinned to an institution, not a sub-location; can add UserCampusAssignment back later if we want sub-location pinning)

### 1.4 Organization changes

Organization drops some fields that now live on School:

| Field | Change |
|---|---|
| `institutionType` | Moved to `School.institutionType`. Org no longer carries it. |
| `gradeLevel` (SchoolType) | Dropped — lived on Org, now lives on `Campus.gradeLevel`. |
| `district` (String) | Dropped — replaced by proper `District` model. |
| `principalName`, `principalEmail`, `principalPhone` | Moved to `School`. |
| `headOfSchoolsName`, `headOfSchoolsEmail`, `headOfSchoolsPhone` | Dropped — this is a District-level role if it exists. Optional future add on District. |
| `gradeRange` (String) | Dropped — derived from `Campus.gradeLevel` aggregations. |
| `studentCount`, `staffCount` | Kept at org level (org-wide stats) but also surfaceable per-School. |
| `latitude`, `longitude`, `physicalAddress` | Dropped — replaced by School/Campus/Site addresses. |
| `logoUrl`, `heroImageUrl`, `theme`, `imagePosition` | Kept at org level (tenant branding). |

Organization relations (what it owns directly):
- Keep: `users`, `roles`, `teams`, `auditLogs`, `tenantModules`, platform admin stuff
- Change: `campuses` → `schools` (top-level children), keep `buildings`/`rooms`/`spaces` as reachable convenience
- New: `districts`, `sites`
- Drop: `campusAssignments` (renamed), `areas` (renamed)

---

## 2. Consumer FK Rename Rules

The 22 models with `schoolId` and 14 with `campusId` all swap meanings. Rule:

| Old column | Old meaning | New column | New meaning |
|---|---|---|---|
| `schoolId` | grade division | `campusId` | sub-location |
| `campusId` | physical location | `schoolId` | institution |

**Every consumer below gets both columns renamed if it has both, or the one it has:**

| Model | Old | New |
|---|---|---|
| User | `schoolId`, `schoolScope` | `campusId`, `campusScope` (plus optional `schoolId` for institution-pinning — see §6 Q1) |
| Ticket | `schoolId` + `campusId` | `campusId` + `schoolId` (both swap) |
| Calendar | `schoolId` + `campusId` | `campusId` + `schoolId` |
| CalendarEvent | `schoolId` | `campusId` |
| AcademicYear | `schoolId` | `campusId` |
| BellSchedule | `schoolId` | `campusId` |
| SpecialDay | `schoolId` + `campusId` | `campusId` + `schoolId` |
| PlanningSeason | `schoolId` + `campusId` | `campusId` + `schoolId` |
| ApprovalRule | `schoolId` + `campusId` | `campusId` + `schoolId` |
| ApprovalChannelConfig | `campusId` | `schoolId` |
| ApprovalFlowEntry | `campusId` | `schoolId` |
| AthleticTeam | `schoolId` | `campusId` |
| MaintenanceTicket | `schoolId` | `campusId` |
| MaintenanceAsset | `schoolId` | `campusId` |
| PmSchedule | `schoolId` | `campusId` |
| ComplianceDomainConfig | `schoolId` | `campusId` |
| ComplianceRecord | `schoolId` | `campusId` |
| Student | `schoolId` | `campusId` |
| ITDevice | `schoolId` | `campusId` |
| ITTicket | `schoolId` | `campusId` |
| ITMagicLink | `schoolId` + `campusId` | `campusId` + `schoolId` |
| ITDeploymentBatch | `schoolId` | `campusId` |
| ITERateEntity | `schoolId` | `campusId` |
| SecurityIncident | `schoolId` | `campusId` |
| EventProject | `schoolId` + `campusId` | `campusId` + `schoolId` |
| EventSeries | `campusId` | `schoolId` |
| DayScheduleAssignment | `campusId` | `schoolId` |
| ModuleRoutingConfig | `campusId` | `schoolId` |
| FormQrCode | `buildingId`, `areaId`, `roomId` | `buildingId`, `spaceId`, `roomId` (area → space) |

All indexes and unique constraints that reference these columns flip accordingly.

---

## 3. Enum Changes

| Enum | Change |
|---|---|
| `SchoolType` | **Rename** to `CampusGradeLevel`. Drop `MULTI_SCHOOL_CAMPUS` (no longer meaningful — multi-campus is expressed by having multiple Campus rows). **Drop `GLOBAL`** (non-academic locations live at the District level, not as a special Campus). Final values: `ELEMENTARY`, `MIDDLE_SCHOOL`, `HIGH_SCHOOL`. |
| `SchoolDivision` | **Drop entirely.** Redundant with `Campus.gradeLevel`. Building used it for "which division is this building for" — covered by Building's polymorphic parent. |
| `CampusType` | **Rename** to `CampusKind`. Keep values `HEADQUARTERS`, `CAMPUS`, `SATELLITE`. |
| `AreaType` | **Rename** to `SpaceType`. Add `PLAYGROUND`, `POOL`, `GARDEN`. Final values: `FIELD`, `COURT`, `GYM`, `COMMON`, `PARKING`, `PLAYGROUND`, `POOL`, `GARDEN`, `OTHER`. |
| `User.schoolScope` | Field **renamed** to `User.campusScope`, type stays `CampusGradeLevel`. |
| `InstitutionType` | Kept, relocated from Organization to School. |

---

## 4. Execution Plan (Drop-and-Rebuild)

**No backfill SQL. No dual-write. No column renames on the 29 consumer tables. Just: export the few things worth keeping, wipe, re-create, re-seed.**

### Phase 1a — This doc approved

You sign off on §1, §2, §3, and §6 open questions below. Nothing runs yet.

### Phase 1b — Schema + local rebuild (1 day, local DB only)

1. **Snapshot what's worth keeping** — quick JSON dump of users (emails, names, roles), org settings (branding, timezone), any seeded ticket data you want. Saved to `scripts/snapshots/pre-phase-1-local.json`.
2. **Rewrite `prisma/schema.prisma`** — all changes from §1–§3 at once (one big edit; easier to review as a single diff than iteratively).
3. **Drop facilities tables on local**:
   ```sql
   DROP TABLE "BuildingSchool" CASCADE;
   DROP TABLE "AreaSchool" CASCADE;
   DROP TABLE "UserCampusAssignment" CASCADE;
   DROP TABLE "Area" CASCADE;
   DROP TABLE "Campus" CASCADE;
   DROP TABLE "School" CASCADE;
   -- Building/Room kept; column changes applied via db push
   ```
4. **Run `npm run db:push`** — Prisma creates new tables (District, Site, School [new meaning], Campus [new meaning], Space [renamed from Area]) and modifies Building/Room/consumer FK columns. Since nothing depends on the dropped columns, db push handles the rest cleanly.
5. **Re-seed Linfield** via a new script `scripts/seed-linfield-phase-1.mjs`:
   - 1 District (default, `isDefault: true`)
   - 1 School ("Linfield Christian School", `institutionType: FAITH_BASED`)
   - 1 Site ("31950 Pauba Rd, Temecula, CA 92592")
   - 3 Campuses (Elementary / Middle / High, all `siteId` pointing at the Site)
   - Buildings re-parented to appropriate Campus
   - Rooms kept (`buildingId` reference preserves through the rebuild if building IDs match; otherwise re-created from snapshot)
6. **Regenerate Prisma client** (`npm run prisma:generate` or equivalent).
7. **Verify local**: run `npm run db:studio`, confirm the shape is right.

### Phase 2 — Code refactor (8–10 days, reviewable chunks)

Order (each step is its own PR-sized review):
1. `src/lib/db/index.ts` — update `orgScopedModels` list (District, School, Campus, Site, Building, Space, Room).
2. `src/lib/permissions.ts` — add `DISTRICTS_*`, `SCHOOLS_*`, `CAMPUSES_*`, `SITES_*`, `SPACES_*` permission constants. Retire `AREAS_*`.
3. `src/lib/services/schoolService.ts`, `districtService.ts` (new), `campusService.ts`, `siteService.ts` (new), `spaceService.ts` (renamed from areaService), `buildingService.ts`.
4. Consumer services (ticketService, maintenanceTicketService, calendarService, approvalRuleService, itTicketService, etc.) — update FK references.
5. API routes — rename `/api/settings/campus/*` → `/api/settings/facilities/*`, add `/api/settings/districts`, `/api/settings/sites`, etc.
6. Hooks — `useActiveSchool` now means "active institution" (different data source, same localStorage key for now or new key `active-school-id` keeps meaning); add `useActiveCampus` (new key `active-campus-id`).
7. Components — `CampusTab` → `FacilitiesTab`, `SchoolsManagement` → `CampusesManagement` (naming inversion), `SchoolSelector` (primary, institution level), add `CampusSelector` (secondary).
8. Seed scripts + smoke tests.
9. Organization registration / onboarding — `seedOrgDefaults` creates default District + School if the onboarding provides school info.

### Phase 3 — Remote cutover (1 day, maintenance window)

1. You explicitly say "go" for remote.
2. Snapshot remote data (Linfield dev org on `yvpbnzeycowtvuxiidbj`).
3. Run same drop SQL on remote via Supabase MCP.
4. `npm run db:push:remote`.
5. Run seed script against remote.
6. Deploy new app code.
7. Verify smoke tests pass against production.

---

## 5. Org Registration — What Changes

`organizationRegistrationService.ts` currently creates Org + User + seeds permissions/roles/teams. Phase 1 adds:

- Create 1 `District` named `"<OrgName> District"` with `isDefault: true`.
- If the onboarding payload includes school info (currently it does — `principalName`, `gradeLevel`, etc. live on Org): create 1 `School` under that District with those fields migrated over.
- If the onboarding provides an address: create 1 `Site` + 1 default `Campus` linked to it.
- Buildings created during finalization (currently named "Main Campus") get `campusId` set to the default Campus.

This means every new Org starts life with a valid hierarchy. No orphans.

---

## 6. Decisions (locked 2026-04-22)

| # | Question | Decision |
|---|---|---|
| 1 | User assigned to institution, campus, or both? | **Both.** `User.schoolId?` (institution) + `User.campusId?` (sub-location). Both optional. |
| 2 | Multi-school assignment junction or simple FK? | **Simple FK, one school per user.** No `UserSchoolAssignment` junction. Can add back later if time-bounded assignment becomes a real requirement. |
| 3 | `institutionType` on Organization or School? | **On School, per school.** Dropped from Organization. |
| 4 | District-level fields? | **Full contact + facilities.** District gets `address`, `city`, `state`, `zip`, `latitude`, `longitude`, `phone`, `email`, `contactName`, `contactTitle`, `logoUrl`, and can own buildings + spaces directly. |
| 5 | Building code uniqueness scope? | **Org-wide unique** — `@@unique([organizationId, code])`. |
| 6 | Keep `GLOBAL` in `CampusGradeLevel`? | **No — drop it.** Non-academic locations (district office, bus barn, central maintenance) live at the District level, not as a special Campus. `Campus.gradeLevel` becomes required with values ELEMENTARY / MIDDLE_SCHOOL / HIGH_SCHOOL only. |
| 7 | SpaceType additions? | **Yes — add all three.** PLAYGROUND, POOL, GARDEN. |
| 8 | AthleticTeam scoping? | **Campus.** Teams attach to the physical campus where they practice/play, not the institution. Keeps the default rename rule (old `schoolId` → new `campusId`). |

### Side-effects of decision #6 (drop `GLOBAL`)

- `Campus.gradeLevel` loses its default — every Campus MUST have a grade level.
- Existing seed logic that created a "Main Campus" with `GLOBAL` grade level needs to choose a real grade level or move its buildings to the District.
- `User.campusScope` (renamed from `schoolScope`) loses its `GLOBAL` value too — use District-level user assignment instead (via new `User.schoolId?`/`districtId?` pattern; see Phase 1b seed logic).

### Side-effect of decision #4 (District as first-class location)

- District model gains all contact + address fields (see updated §1.1).
- Building's polymorphic parent already supports `districtId` — no change there.
- Space model already supports `districtId` — no change there.
- Onboarding creates a default District; if the user provides a district office address, it lands on the District itself (not a synthetic Campus).

---

## 7. Next step

Decisions are locked. On your explicit "go" for Phase 1b:

1. Snapshot current local DB (users + org settings + any seeded facilities data worth keeping).
2. Rewrite `prisma/schema.prisma` with all §1–§3 changes as a single reviewable diff.
3. Drop facilities tables on **local only** (`Campus`, `School`, `Area`, `BuildingSchool`, `AreaSchool`, `UserCampusAssignment`).
4. `npm run db:push` to build the new shape.
5. Re-seed Linfield via `scripts/seed-linfield-phase-1.mjs` — 1 District, 1 School, 1 Site, 3 Campuses, buildings re-parented.
6. Open Prisma Studio for you to eyeball the result.

Phase 2 (code refactor) and Phase 3 (remote cutover) do **not** start until you approve what Phase 1b produced.

Say "go Phase 1b" when you're ready.
