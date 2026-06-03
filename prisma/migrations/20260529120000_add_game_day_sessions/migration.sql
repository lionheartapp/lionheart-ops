-- Baseline game core.
-- This migration was added after athletics games existed in the baseline DB.
-- Fresh shadow databases need the parent Game table before this FK can run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HomeAway') THEN
    CREATE TYPE "HomeAway" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Game" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "athleticTeamId" TEXT NOT NULL,
  "opponentAthleticTeamId" TEXT,
  "opponentName" TEXT NOT NULL,
  "homeAway" "HomeAway" NOT NULL DEFAULT 'HOME',
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "venue" TEXT,
  "calendarEventId" TEXT,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "isFinal" BOOLEAN NOT NULL DEFAULT false,
  "conferenceId" TEXT,
  "homeOrganizationId" TEXT,
  "awayOrganizationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Game_organizationId_idx" ON "Game"("organizationId");
CREATE INDEX IF NOT EXISTS "Game_athleticTeamId_idx" ON "Game"("athleticTeamId");
CREATE INDEX IF NOT EXISTS "Game_organizationId_startTime_idx" ON "Game"("organizationId", "startTime");
CREATE INDEX IF NOT EXISTS "Game_conferenceId_idx" ON "Game"("conferenceId");
CREATE INDEX IF NOT EXISTS "Game_homeOrganizationId_idx" ON "Game"("homeOrganizationId");
CREATE INDEX IF NOT EXISTS "Game_awayOrganizationId_idx" ON "Game"("awayOrganizationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_organizationId_fkey') THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Conference')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_conferenceId_fkey') THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_conferenceId_fkey"
      FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_homeOrganizationId_fkey') THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_homeOrganizationId_fkey"
      FOREIGN KEY ("homeOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Game_awayOrganizationId_fkey') THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_awayOrganizationId_fkey"
      FOREIGN KEY ("awayOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE "GameDaySession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "currentPeriod" INTEGER NOT NULL DEFAULT 1,
    "periodLabel" TEXT,
    "clockSecondsRemaining" INTEGER,
    "lineup" JSONB,
    "gameState" JSONB,
    "playLog" JSONB,
    "startedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "lastSavedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDaySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameDaySession_gameId_key" ON "GameDaySession"("gameId");
CREATE INDEX "GameDaySession_organizationId_idx" ON "GameDaySession"("organizationId");
CREATE INDEX "GameDaySession_gameId_idx" ON "GameDaySession"("gameId");
CREATE INDEX "GameDaySession_status_idx" ON "GameDaySession"("status");

ALTER TABLE "GameDaySession"
ADD CONSTRAINT "GameDaySession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameDaySession"
ADD CONSTRAINT "GameDaySession_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "Game"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
