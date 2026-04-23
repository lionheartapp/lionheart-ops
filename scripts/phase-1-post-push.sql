-- =====================================================================
-- Phase 1b post-push constraints
-- =====================================================================
-- Run AFTER `prisma db push` has created the new facility tables.
-- Adds CHECK constraints that Prisma DSL cannot express natively:
--   - Building: exactly one of (districtId, schoolId, campusId) must be set
--   - Space:    exactly one of (buildingId, campusId, schoolId, districtId) must be set
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/phase-1-post-push.sql
-- =====================================================================

BEGIN;

-- ── Building polymorphic parent constraint ──────────────────────────
-- Exactly one of districtId / schoolId / campusId must be non-null.
ALTER TABLE "Building"
  DROP CONSTRAINT IF EXISTS "Building_parent_exactly_one";

ALTER TABLE "Building"
  ADD CONSTRAINT "Building_parent_exactly_one"
  CHECK (
    (CASE WHEN "districtId" IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "schoolId"   IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "campusId"   IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

-- ── Space polymorphic parent constraint ─────────────────────────────
-- Exactly one of buildingId / campusId / schoolId / districtId must be non-null.
ALTER TABLE "Space"
  DROP CONSTRAINT IF EXISTS "Space_parent_exactly_one";

ALTER TABLE "Space"
  ADD CONSTRAINT "Space_parent_exactly_one"
  CHECK (
    (CASE WHEN "buildingId" IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "campusId"   IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "schoolId"   IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "districtId" IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

COMMIT;

-- Done. Now run:
--   node scripts/seed-linfield-phase-1.mjs
