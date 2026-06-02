-- Conference layer.
-- Restored from the current schema because the migration directory existed in
-- local migration history, but the SQL file was missing from the workspace.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConferenceStatus') THEN
    CREATE TYPE "ConferenceStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PENDING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConferenceVisibility') THEN
    CREATE TYPE "ConferenceVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConferenceMembershipStatus') THEN
    CREATE TYPE "ConferenceMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConferenceRole') THEN
    CREATE TYPE "ConferenceRole" AS ENUM ('OWNER', 'ADMIN', 'SCHEDULER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConferenceInviteStatus') THEN
    CREATE TYPE "ConferenceInviteStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Conference" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "description" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "status" "ConferenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "visibility" "ConferenceVisibility" NOT NULL DEFAULT 'PUBLIC',
  "foundingOrgId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConferenceMembership" (
  "id" TEXT NOT NULL,
  "conferenceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "ConferenceMembershipStatus" NOT NULL DEFAULT 'PENDING',
  "invitedBy" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "ConferenceMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConferenceTeamParticipation" (
  "id" TEXT NOT NULL,
  "conferenceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "athleticTeamId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "ConferenceTeamParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConferenceAdmin" (
  "id" TEXT NOT NULL,
  "conferenceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ConferenceRole" NOT NULL DEFAULT 'ADMIN',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedBy" TEXT,
  CONSTRAINT "ConferenceAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConferenceInvite" (
  "id" TEXT NOT NULL,
  "conferenceId" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactName" TEXT,
  "token" TEXT NOT NULL,
  "status" "ConferenceInviteStatus" NOT NULL DEFAULT 'PENDING',
  "invitedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "redeemedOrgId" TEXT,
  CONSTRAINT "ConferenceInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conference_slug_key" ON "Conference"("slug");
CREATE INDEX IF NOT EXISTS "Conference_slug_idx" ON "Conference"("slug");
CREATE INDEX IF NOT EXISTS "Conference_foundingOrgId_idx" ON "Conference"("foundingOrgId");
CREATE INDEX IF NOT EXISTS "Conference_status_idx" ON "Conference"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceMembership_conferenceId_organizationId_key" ON "ConferenceMembership"("conferenceId", "organizationId");
CREATE INDEX IF NOT EXISTS "ConferenceMembership_organizationId_idx" ON "ConferenceMembership"("organizationId");
CREATE INDEX IF NOT EXISTS "ConferenceMembership_status_idx" ON "ConferenceMembership"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceTeamParticipation_conferenceId_athleticTeamId_seasonId_key" ON "ConferenceTeamParticipation"("conferenceId", "athleticTeamId", "seasonId");
CREATE INDEX IF NOT EXISTS "ConferenceTeamParticipation_organizationId_idx" ON "ConferenceTeamParticipation"("organizationId");
CREATE INDEX IF NOT EXISTS "ConferenceTeamParticipation_athleticTeamId_idx" ON "ConferenceTeamParticipation"("athleticTeamId");
CREATE INDEX IF NOT EXISTS "ConferenceTeamParticipation_seasonId_idx" ON "ConferenceTeamParticipation"("seasonId");

CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceAdmin_conferenceId_userId_key" ON "ConferenceAdmin"("conferenceId", "userId");
CREATE INDEX IF NOT EXISTS "ConferenceAdmin_userId_idx" ON "ConferenceAdmin"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceInvite_token_key" ON "ConferenceInvite"("token");
CREATE INDEX IF NOT EXISTS "ConferenceInvite_conferenceId_idx" ON "ConferenceInvite"("conferenceId");
CREATE INDEX IF NOT EXISTS "ConferenceInvite_token_idx" ON "ConferenceInvite"("token");
CREATE INDEX IF NOT EXISTS "ConferenceInvite_contactEmail_idx" ON "ConferenceInvite"("contactEmail");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conference_foundingOrgId_fkey') THEN
    ALTER TABLE "Conference"
      ADD CONSTRAINT "Conference_foundingOrgId_fkey"
      FOREIGN KEY ("foundingOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceMembership_conferenceId_fkey') THEN
    ALTER TABLE "ConferenceMembership"
      ADD CONSTRAINT "ConferenceMembership_conferenceId_fkey"
      FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceMembership_organizationId_fkey') THEN
    ALTER TABLE "ConferenceMembership"
      ADD CONSTRAINT "ConferenceMembership_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceTeamParticipation_conferenceId_fkey') THEN
    ALTER TABLE "ConferenceTeamParticipation"
      ADD CONSTRAINT "ConferenceTeamParticipation_conferenceId_fkey"
      FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceTeamParticipation_organizationId_fkey') THEN
    ALTER TABLE "ConferenceTeamParticipation"
      ADD CONSTRAINT "ConferenceTeamParticipation_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AthleticTeam')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceTeamParticipation_athleticTeamId_fkey') THEN
    ALTER TABLE "ConferenceTeamParticipation"
      ADD CONSTRAINT "ConferenceTeamParticipation_athleticTeamId_fkey"
      FOREIGN KEY ("athleticTeamId") REFERENCES "AthleticTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AthleticSeason')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceTeamParticipation_seasonId_fkey') THEN
    ALTER TABLE "ConferenceTeamParticipation"
      ADD CONSTRAINT "ConferenceTeamParticipation_seasonId_fkey"
      FOREIGN KEY ("seasonId") REFERENCES "AthleticSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceAdmin_conferenceId_fkey') THEN
    ALTER TABLE "ConferenceAdmin"
      ADD CONSTRAINT "ConferenceAdmin_conferenceId_fkey"
      FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceAdmin_userId_fkey') THEN
    ALTER TABLE "ConferenceAdmin"
      ADD CONSTRAINT "ConferenceAdmin_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceInvite_conferenceId_fkey') THEN
    ALTER TABLE "ConferenceInvite"
      ADD CONSTRAINT "ConferenceInvite_conferenceId_fkey"
      FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConferenceInvite_redeemedOrgId_fkey') THEN
    ALTER TABLE "ConferenceInvite"
      ADD CONSTRAINT "ConferenceInvite_redeemedOrgId_fkey"
      FOREIGN KEY ("redeemedOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Game') THEN
    ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "conferenceId" TEXT;
    ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "homeOrganizationId" TEXT;
    ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "awayOrganizationId" TEXT;

    CREATE INDEX IF NOT EXISTS "Game_conferenceId_idx" ON "Game"("conferenceId");
    CREATE INDEX IF NOT EXISTS "Game_homeOrganizationId_idx" ON "Game"("homeOrganizationId");
    CREATE INDEX IF NOT EXISTS "Game_awayOrganizationId_idx" ON "Game"("awayOrganizationId");

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_conferenceId_fkey') THEN
      ALTER TABLE "Game"
        ADD CONSTRAINT "Game_conferenceId_fkey"
        FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_homeOrganizationId_fkey') THEN
      ALTER TABLE "Game"
        ADD CONSTRAINT "Game_homeOrganizationId_fkey"
        FOREIGN KEY ("homeOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Organization')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_awayOrganizationId_fkey') THEN
      ALTER TABLE "Game"
        ADD CONSTRAINT "Game_awayOrganizationId_fkey"
        FOREIGN KEY ("awayOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
