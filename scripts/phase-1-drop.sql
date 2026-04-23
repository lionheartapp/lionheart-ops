-- =====================================================================
-- Phase 1b pre-push cleanup
-- =====================================================================
-- Run against LOCAL DB only. Wraps the ontology-inversion tear-down so
-- `prisma db push` can cleanly create the new shape afterwards.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/phase-1-drop.sql
-- or via node:
--   node scripts/phase-1-drop-runner.mjs
--
-- This drops:
--   - All facility tables being replaced (Campus, School, Area, junctions)
--   - All columns on consumer tables that use old enums or point to dropped tables
--   - All old enum types that no longer have references
--
-- After this runs, `npx prisma db push --accept-data-loss` rebuilds the shape.
-- =====================================================================

BEGIN;

-- ── Tables being dropped entirely ────────────────────────────────────
DROP TABLE IF EXISTS "BuildingSchool" CASCADE;
DROP TABLE IF EXISTS "AreaSchool" CASCADE;
DROP TABLE IF EXISTS "UserCampusAssignment" CASCADE;
DROP TABLE IF EXISTS "Area" CASCADE;
DROP TABLE IF EXISTS "Campus" CASCADE;
DROP TABLE IF EXISTS "School" CASCADE;

-- ── Columns using dropped enum SchoolDivision ───────────────────────
ALTER TABLE "Building" DROP COLUMN IF EXISTS "schoolDivision";

-- ── Columns using dropped/renamed enum SchoolType ──────────────────
-- (being replaced by CampusGradeLevel with different values — can't be migrated automatically)
ALTER TABLE "User" DROP COLUMN IF EXISTS "schoolScope";
ALTER TABLE "User" DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "gradeLevel";
ALTER TABLE "AthleticTeam" DROP COLUMN IF EXISTS "gradeLevel";

-- ── Organization fields moved to School/District ──────────────────
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "institutionType";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "physicalAddress";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "district";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "principalName";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "principalEmail";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "principalPhone";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "headOfSchoolsName";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "headOfSchoolsEmail";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "headOfSchoolsPhone";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "gradeRange";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "longitude";

-- ── Drop old enums now that nothing references them ────────────────
DROP TYPE IF EXISTS "SchoolDivision" CASCADE;
DROP TYPE IF EXISTS "SchoolType" CASCADE;
DROP TYPE IF EXISTS "AreaType" CASCADE;
DROP TYPE IF EXISTS "CampusType" CASCADE;

-- ── Consumer FK columns: schoolId → campusId rename (single column) ──
-- Old schoolId pointed to dropped grade-division School. New campusId points to new Campus.
-- Drop the old column; db push will recreate it with the new name.
ALTER TABLE "AcademicYear"           DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "BellSchedule"           DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "CalendarEvent"          DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "MaintenanceTicket"      DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "MaintenanceAsset"       DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "PmSchedule"             DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ComplianceDomainConfig" DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ComplianceRecord"       DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "Student"                DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ITDevice"               DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ITTicket"               DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ITDeploymentBatch"      DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "ITERateEntity"          DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "SecurityIncident"       DROP COLUMN IF EXISTS "schoolId";
ALTER TABLE "AthleticTeam"           DROP COLUMN IF EXISTS "schoolId";

-- ── Consumer FK columns: campusId → schoolId rename (single column) ──
-- Old campusId pointed to dropped physical-location Campus. New schoolId points to new School.
ALTER TABLE "DayScheduleAssignment"  DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "ApprovalChannelConfig"  DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "EventSeries"            DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "ModuleRoutingConfig"    DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "ApprovalFlowEntry"      DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "TenantModule"           DROP COLUMN IF EXISTS "campusId";

-- ── Dual-column consumer models (had both schoolId and campusId) ────
-- Drop both — meanings swap. Prisma db push recreates with the new semantics.
ALTER TABLE "Ticket"         DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "Calendar"       DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "SpecialDay"     DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "PlanningSeason" DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "ApprovalRule"   DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "ITMagicLink"    DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";
ALTER TABLE "EventProject"   DROP COLUMN IF EXISTS "schoolId", DROP COLUMN IF EXISTS "campusId";

-- ── Area → Space renames (areaId → spaceId) ──────────────────────────
ALTER TABLE "CalendarEvent"     DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "MaintenanceTicket" DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "MaintenanceAsset"  DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "PmSchedule"        DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "ITTicket"          DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "EventProject"      DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "FormQrCode"        DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "Room"              DROP COLUMN IF EXISTS "areaId";

-- ── Rename LocationRefType.AREA enum value → SPACE ──────────────────
-- Postgres allows renaming enum values in place
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'LocationRefType' AND e.enumlabel = 'AREA'
  ) THEN
    ALTER TYPE "LocationRefType" RENAME VALUE 'AREA' TO 'SPACE';
  END IF;
END $$;

COMMIT;

-- Done. Now run:
--   npx prisma db push --accept-data-loss
--   psql "$DATABASE_URL" -f scripts/phase-1-post-push.sql
--   node scripts/seed-linfield-phase-1.mjs
