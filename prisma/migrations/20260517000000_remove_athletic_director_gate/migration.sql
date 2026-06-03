-- Baseline event project core.
-- This migration originally only removed one column from EventProject, but
-- fresh shadow databases need the original table before the DROP can run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventProjectStatus') THEN
    CREATE TYPE "EventProjectStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventProjectSource') THEN
    CREATE TYPE "EventProjectSource" AS ENUM ('PLANNING_SUBMISSION', 'SERIES', 'DIRECT_REQUEST');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EventProject" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campusId" TEXT,
  "schoolId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "EventProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "EventProjectSource" NOT NULL DEFAULT 'DIRECT_REQUEST',
  "sourceId" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "requiresAthleticDirector" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "EventProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventProject_organizationId_status_idx" ON "EventProject"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "EventProject_organizationId_startsAt_idx" ON "EventProject"("organizationId", "startsAt");
CREATE INDEX IF NOT EXISTS "EventProject_createdById_idx" ON "EventProject"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventProject_organizationId_fkey') THEN
    ALTER TABLE "EventProject"
      ADD CONSTRAINT "EventProject_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventProject_createdById_fkey') THEN
    ALTER TABLE "EventProject"
      ADD CONSTRAINT "EventProject_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventProject_approvedById_fkey') THEN
    ALTER TABLE "EventProject"
      ADD CONSTRAINT "EventProject_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DropColumn: remove requiresAthleticDirector from EventProject
ALTER TABLE "EventProject" DROP COLUMN IF EXISTS "requiresAthleticDirector";

-- Note: The ATHLETIC_DIRECTOR value in ResourceRequestType enum is left in place.
-- Postgres cannot drop enum values directly without recreating the type.
-- Since no code references it anymore, it's harmless dead weight.
-- A future migration can clean it up with a full enum rebuild if desired.
