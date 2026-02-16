-- Apply Role-and-Team schema changes (run in Supabase SQL Editor)
-- Idempotent: safe to run once; skips if column/type/table already exists.

-- 1. Organization: allowTeacherEventRequests (Linfield vs Alternative toggle)
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "allowTeacherEventRequests" boolean NOT NULL DEFAULT false;

-- 2. User: teamIds (e.g. ['teachers'], ['it','facilities'])
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "teamIds" text[] NOT NULL DEFAULT '{}';

-- 3. Form: visibility + createdByUserId (personal forms)
ALTER TABLE "Form"
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'org';
ALTER TABLE "Form"
  ADD COLUMN IF NOT EXISTS "createdByUserId" text;

CREATE INDEX IF NOT EXISTS "Form_createdByUserId_idx" ON "Form"("createdByUserId");

-- 4. EventStatus enum + Event columns (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventStatus') THEN
    CREATE TYPE "EventStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
  END IF;
END$$;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "status" "EventStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "submittedById" text;
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "routedToIds" text[] NOT NULL DEFAULT '{}';

-- Optional: add chairsRequested, tablesRequested if your Event table doesn't have them
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "chairsRequested" integer;
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "tablesRequested" integer;

CREATE INDEX IF NOT EXISTS "Event_submittedById_idx" ON "Event"("submittedById");

-- 5. Team table
CREATE TABLE IF NOT EXISTS "Team" (
  "id" text NOT NULL,
  "organizationId" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Team_organizationId_slug_key" UNIQUE ("organizationId", "slug")
);

CREATE INDEX IF NOT EXISTS "Team_organizationId_idx" ON "Team"("organizationId");

-- Done. Refresh Schema Visualizer to see new columns and Team table.
