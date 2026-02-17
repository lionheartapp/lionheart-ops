-- Water Management: WaterAsset, WaterLog, WaterAssetConfig, org lat/long
-- Replaces PondLog/PondConfig with multi-asset water management

-- 1. Add latitude/longitude to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- 2. Create WaterAssetType enum
DO $$ BEGIN
  CREATE TYPE "WaterAssetType" AS ENUM ('POND', 'POOL', 'FOUNTAIN', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create WaterAsset table
CREATE TABLE IF NOT EXISTS "WaterAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WaterAssetType" NOT NULL,
    "volumeGallons" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "thresholds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WaterAsset_organizationId_idx" ON "WaterAsset"("organizationId");
ALTER TABLE "WaterAsset" ADD CONSTRAINT "WaterAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Create WaterLog table
CREATE TABLE IF NOT EXISTS "WaterLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "waterAssetId" TEXT,
    "pH" DOUBLE PRECISION NOT NULL,
    "turbidity" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "dissolvedOxygen" DOUBLE PRECISION,
    "alkalinity" DOUBLE PRECISION,
    "chlorine" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WaterLog_organizationId_idx" ON "WaterLog"("organizationId");
CREATE INDEX IF NOT EXISTS "WaterLog_waterAssetId_idx" ON "WaterLog"("waterAssetId");
CREATE INDEX IF NOT EXISTS "WaterLog_createdAt_idx" ON "WaterLog"("createdAt");
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_waterAssetId_fkey" FOREIGN KEY ("waterAssetId") REFERENCES "WaterAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Create WaterAssetConfig table
CREATE TABLE IF NOT EXISTS "WaterAssetConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterAssetConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaterAssetConfig_key_key" ON "WaterAssetConfig"("key");
CREATE INDEX IF NOT EXISTS "WaterAssetConfig_organizationId_idx" ON "WaterAssetConfig"("organizationId");
ALTER TABLE "WaterAssetConfig" ADD CONSTRAINT "WaterAssetConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Migrate PondLog -> WaterLog (if PondLog exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PondLog') THEN
    INSERT INTO "WaterLog" ("id", "organizationId", "pH", "turbidity", "temperature", "dissolvedOxygen", "alkalinity", "source", "notes", "createdAt")
    SELECT "id", "organizationId", "pH", "turbidity", "temperature", "dissolvedOxygen", "alkalinity", COALESCE("source", 'manual'), "notes", "createdAt"
    FROM "PondLog"
    ON CONFLICT ("id") DO NOTHING;
    DROP TABLE "PondLog";
  END IF;
END $$;

-- 7. Migrate PondConfig -> WaterAssetConfig (if PondConfig exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PondConfig') THEN
    INSERT INTO "WaterAssetConfig" ("id", "organizationId", "key", "value", "updatedAt")
    SELECT "id", "organizationId", "key", "value", "updatedAt"
    FROM "PondConfig"
    ON CONFLICT ("id") DO NOTHING;
    DROP TABLE "PondConfig";
  END IF;
END $$;
