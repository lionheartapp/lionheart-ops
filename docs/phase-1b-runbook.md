# Phase 1b Runbook — Ontology Inversion (LOCAL ONLY)

**Status:** Scripts ready. Nothing has touched your DB yet.

**Remote DB:** untouched. This runbook is local-only. Remote migration comes later and needs its own approval.

---

## What this does

Rebuilds the facility tables with the new ontology:

- **Old:** `Campus` = physical location, `School` = grade division
- **New:** `School` = institution, `Campus` = physical sub-location under a School, plus first-class `District` and `Site`

Because there are no real customers yet, we drop-and-rebuild instead of writing a data migration. Snapshot first, then execute.

---

## Pre-flight checks

1. Confirm you're on the local DB:

   ```bash
   echo $DATABASE_URL
   # Should point to localhost or lionheart_local, NOT yvpbnzeycowtvuxiidbj.supabase.co
   ```

2. Confirm Prisma schema validates:

   ```bash
   npx prisma validate
   # Expected: "The schema at prisma/schema.prisma is valid"
   ```

3. Confirm the scripts exist:

   ```bash
   ls -l scripts/snapshot-pre-phase-1.mjs \
          scripts/phase-1-drop.sql \
          scripts/phase-1-post-push.sql \
          scripts/seed-linfield-phase-1.mjs
   ```

---

## Execution order

Run these from the project root, one at a time. Stop and report if any step errors.

### 1. Snapshot (rollback safety net)

```bash
node scripts/snapshot-pre-phase-1.mjs
```

Writes `scripts/snapshots/pre-phase-1-local.json` containing every row of the old facility + identity tables. Keep this file until you're sure Phase 1b is solid.

### 2. Drop old shape

```bash
psql "$DATABASE_URL" -f scripts/phase-1-drop.sql
```

Drops old facility tables, old enums, and all consumer FK columns that need to be renamed or re-typed. Wrapped in `BEGIN`/`COMMIT` — either the whole thing applies or nothing does.

### 3. Push new shape

```bash
npx prisma db push --accept-data-loss
```

Creates the new `District`, `Site`, `School`, `Campus`, `Space`, `Building`, `Room` tables and re-adds the renamed consumer columns.

`--accept-data-loss` is required because we just dropped columns. The drop already happened; this flag just silences Prisma's warning.

### 4. Add CHECK constraints

```bash
psql "$DATABASE_URL" -f scripts/phase-1-post-push.sql
```

Adds the polymorphic-parent CHECK constraints that Prisma DSL cannot express:

- `Building`: exactly one of `districtId` / `schoolId` / `campusId` must be set
- `Space`: exactly one of `buildingId` / `campusId` / `schoolId` / `districtId` must be set

### 5. Re-seed Linfield

```bash
node scripts/seed-linfield-phase-1.mjs
```

Creates:

- 1 District ("Linfield Christian School District", default)
- 1 School ("Linfield Christian School", `FAITH_BASED`)
- 1 Site (`31950 Pauba Rd, Temecula, CA 92592`)
- 3 Campuses (Elementary / Middle / High, all at the Site)
- Pins existing users to the School

Idempotent — safe to re-run.

### 6. Verify

```bash
npm run db:studio
```

Check:

- `District` has 1 row, `isDefault: true`
- `School` has 1 row, `districtId` set, `institutionType: FAITH_BASED`
- `Site` has 1 row, full address
- `Campus` has 3 rows, each with `schoolId` and `siteId` set, `gradeLevel` one of `ELEMENTARY`/`MIDDLE_SCHOOL`/`HIGH_SCHOOL`
- `User` rows for Linfield org have `schoolId` populated

---

## If something goes wrong

### Step 2 or 4 fails

Both SQL scripts are transactional. Failure rolls back — your DB is untouched. Read the error, fix, retry.

### Step 3 fails (db push)

Usually means the drop didn't clean up everything. Compare the error against `scripts/phase-1-drop.sql`. Most likely a consumer column, enum, or FK I missed. Add it to the drop, re-run step 2, retry step 3.

### Step 5 fails

Re-seed is idempotent. Most common cause: schema field mismatch. Check the Prisma client was regenerated (`db push` does this automatically).

### Full rollback

If you need to abandon Phase 1b:

```bash
# Drop all new tables
psql "$DATABASE_URL" <<'SQL'
  DROP TABLE IF EXISTS "Space", "Campus", "School", "Site", "District", "Building", "Room" CASCADE;
SQL

# Revert schema.prisma (git checkout), then:
npx prisma db push --accept-data-loss

# Restore data from snapshot (custom restore script — write if needed)
```

---

## After verification

1. Commit the schema + scripts together with message:

   ```
   facilities: invert School/Campus ontology (Phase 1b, local only)
   ```

2. Do NOT push to remote yet. Remote migration is Phase 1c and needs separate approval.

3. Update any app code that reads the old shape. Search for:

   ```bash
   rg -n 'schoolId|campusId|areaId|SchoolType|SchoolDivision|AreaType|CampusType' src
   ```

   Most consumer changes are FK renames you'll address as you touch each surface.
