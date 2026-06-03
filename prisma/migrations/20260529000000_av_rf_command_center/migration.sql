-- Baseline calendar event core needed by RF plan links.
-- The full calendar module was present in the baseline database, but this
-- migration can be replayed in a fresh shadow DB before that history exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpaceType') THEN
    CREATE TYPE "SpaceType" AS ENUM ('FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'PLAYGROUND', 'POOL', 'GARDEN', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpaceStatus') THEN
    CREATE TYPE "SpaceStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarEventStatus') THEN
    CREATE TYPE "CalendarEventStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'TENTATIVE', 'CANCELLED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Space" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "buildingId" TEXT,
  "campusId" TEXT,
  "schoolId" TEXT,
  "districtId" TEXT,
  "name" TEXT NOT NULL,
  "spaceType" "SpaceType" NOT NULL DEFAULT 'OTHER',
  "status" "SpaceStatus" NOT NULL DEFAULT 'ACTIVE',
  "capacity" INTEGER,
  "openTime" TEXT,
  "closeTime" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "polygonCoordinates" JSONB,
  "images" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Space_organizationId_buildingId_name_key" ON "Space"("organizationId", "buildingId", "name");
CREATE INDEX IF NOT EXISTS "Space_organizationId_isActive_idx" ON "Space"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "Space_buildingId_idx" ON "Space"("buildingId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Space_organizationId_fkey') THEN
    ALTER TABLE "Space"
      ADD CONSTRAINT "Space_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Building')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Space_buildingId_fkey') THEN
    ALTER TABLE "Space"
      ADD CONSTRAINT "Space_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campusId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
  "isAllDay" BOOLEAN NOT NULL DEFAULT false,
  "calendarStatus" "CalendarEventStatus" NOT NULL DEFAULT 'DRAFT',
  "buildingId" TEXT,
  "spaceId" TEXT,
  "roomId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEvent_organizationId_startTime_idx" ON "CalendarEvent"("organizationId", "startTime");
CREATE INDEX IF NOT EXISTS "CalendarEvent_calendarId_idx" ON "CalendarEvent"("calendarId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_organizationId_fkey') THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "WirelessDeviceBrand" AS ENUM ('SHURE', 'SENNHEISER', 'AUDIO_TECHNICA', 'WISYCOM', 'LECTROSONICS', 'RF_EXPLORER', 'OTHER');

-- CreateEnum
CREATE TYPE "WirelessDeviceKind" AS ENUM ('HANDHELD', 'LAVALIER', 'HEADSET', 'BODY_PACK', 'IEM', 'RECEIVER', 'ANTENNA', 'SCANNER', 'OTHER');

-- CreateEnum
CREATE TYPE "WirelessDeviceStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "WirelessPlanStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'COORDINATED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RfScanSource" AS ENUM ('UPLOAD', 'BRIDGE', 'HARDWARE', 'SAMPLE');

-- CreateEnum
CREATE TYPE "RfBridgeStatus" AS ENUM ('PENDING', 'ONLINE', 'STALE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RfSeverity" AS ENUM ('BLOCKER', 'WARNING', 'ADVISORY');

-- CreateEnum
CREATE TYPE "RfConflictType" AS ENUM ('SAME_FREQUENCY', 'MIN_SPACING', 'INTERMOD_3RD', 'INTERMOD_5TH', 'EXCLUSION', 'SCAN_NOISE', 'UNKNOWN_PROFILE');

-- CreateEnum
CREATE TYPE "RfRecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "WirelessDeviceProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brand" "WirelessDeviceBrand" NOT NULL DEFAULT 'OTHER',
    "model" TEXT NOT NULL,
    "bandLabel" TEXT,
    "minFrequencyHz" BIGINT NOT NULL,
    "maxFrequencyHz" BIGINT NOT NULL,
    "minSpacingHz" INTEGER NOT NULL DEFAULT 250000,
    "intermodSpacingHz" INTEGER NOT NULL DEFAULT 25000,
    "channelStepHz" INTEGER NOT NULL DEFAULT 25000,
    "maxRecommendedUnits" INTEGER,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WirelessDeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WirelessDevice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "brand" "WirelessDeviceBrand" NOT NULL DEFAULT 'OTHER',
    "model" TEXT,
    "kind" "WirelessDeviceKind" NOT NULL DEFAULT 'OTHER',
    "serialNumber" TEXT,
    "bandLabel" TEXT,
    "minFrequencyHz" BIGINT,
    "maxFrequencyHz" BIGINT,
    "currentFrequencyHz" BIGINT,
    "status" "WirelessDeviceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "batteryType" TEXT,
    "capsuleType" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WirelessDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WirelessFrequencyPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventProjectId" TEXT,
    "calendarEventId" TEXT,
    "campusId" TEXT,
    "buildingId" TEXT,
    "spaceId" TEXT,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "status" "WirelessPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "notes" TEXT,
    "createdById" TEXT,
    "coordinatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WirelessFrequencyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WirelessFrequencyAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "deviceId" TEXT,
    "label" TEXT NOT NULL,
    "use" TEXT,
    "assignedTo" TEXT,
    "frequencyHz" BIGINT,
    "suggestedFrequencyHz" BIGINT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "soundcheckStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "batteryStatus" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WirelessFrequencyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfScan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT,
    "venueProfileId" TEXT,
    "bridgeNodeId" TEXT,
    "name" TEXT NOT NULL,
    "source" "RfScanSource" NOT NULL DEFAULT 'UPLOAD',
    "fileName" TEXT,
    "thresholdDbm" DOUBLE PRECISION NOT NULL DEFAULT -85,
    "minFrequencyHz" BIGINT,
    "maxFrequencyHz" BIGINT,
    "pointCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RfScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfScanPoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "frequencyHz" BIGINT NOT NULL,
    "signalDbm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfScanPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfExclusionRange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "venueProfileId" TEXT,
    "scanId" TEXT,
    "label" TEXT NOT NULL,
    "reason" TEXT,
    "startHz" BIGINT NOT NULL,
    "endHz" BIGINT NOT NULL,
    "severity" "RfSeverity" NOT NULL DEFAULT 'WARNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfExclusionRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfVenueProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campusId" TEXT,
    "buildingId" TEXT,
    "spaceId" TEXT,
    "roomId" TEXT,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "noiseSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RfVenueProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfBridgeNode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RfBridgeStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "version" TEXT,
    "supportedBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceSummary" JSONB,
    "pairedById" TEXT,
    "pairedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RfBridgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfPlanConflict" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "assignmentAId" TEXT,
    "assignmentBId" TEXT,
    "type" "RfConflictType" NOT NULL,
    "severity" "RfSeverity" NOT NULL,
    "frequencyHz" BIGINT,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfPlanConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "frequencyHz" BIGINT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "reason" TEXT NOT NULL,
    "status" "RfRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WirelessDeviceProfile_organizationId_deletedAt_idx" ON "WirelessDeviceProfile"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "WirelessDeviceProfile_organizationId_brand_idx" ON "WirelessDeviceProfile"("organizationId", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "WirelessDeviceProfile_organizationId_brand_model_bandLabel_key" ON "WirelessDeviceProfile"("organizationId", "brand", "model", "bandLabel");

-- CreateIndex
CREATE INDEX "WirelessDevice_organizationId_deletedAt_idx" ON "WirelessDevice"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "WirelessDevice_organizationId_status_idx" ON "WirelessDevice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WirelessDevice_profileId_idx" ON "WirelessDevice"("profileId");

-- CreateIndex
CREATE INDEX "WirelessDevice_inventoryItemId_idx" ON "WirelessDevice"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WirelessDevice_organizationId_serialNumber_key" ON "WirelessDevice"("organizationId", "serialNumber");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_organizationId_status_idx" ON "WirelessFrequencyPlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_organizationId_startsAt_idx" ON "WirelessFrequencyPlan"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_organizationId_deletedAt_idx" ON "WirelessFrequencyPlan"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_eventProjectId_idx" ON "WirelessFrequencyPlan"("eventProjectId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_calendarEventId_idx" ON "WirelessFrequencyPlan"("calendarEventId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_buildingId_idx" ON "WirelessFrequencyPlan"("buildingId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_spaceId_idx" ON "WirelessFrequencyPlan"("spaceId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyPlan_roomId_idx" ON "WirelessFrequencyPlan"("roomId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyAssignment_organizationId_idx" ON "WirelessFrequencyAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyAssignment_planId_idx" ON "WirelessFrequencyAssignment"("planId");

-- CreateIndex
CREATE INDEX "WirelessFrequencyAssignment_deviceId_idx" ON "WirelessFrequencyAssignment"("deviceId");

-- CreateIndex
CREATE INDEX "RfScan_organizationId_deletedAt_idx" ON "RfScan"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "RfScan_planId_idx" ON "RfScan"("planId");

-- CreateIndex
CREATE INDEX "RfScan_venueProfileId_idx" ON "RfScan"("venueProfileId");

-- CreateIndex
CREATE INDEX "RfScan_bridgeNodeId_idx" ON "RfScan"("bridgeNodeId");

-- CreateIndex
CREATE INDEX "RfScanPoint_organizationId_idx" ON "RfScanPoint"("organizationId");

-- CreateIndex
CREATE INDEX "RfScanPoint_scanId_frequencyHz_idx" ON "RfScanPoint"("scanId", "frequencyHz");

-- CreateIndex
CREATE INDEX "RfExclusionRange_organizationId_idx" ON "RfExclusionRange"("organizationId");

-- CreateIndex
CREATE INDEX "RfExclusionRange_venueProfileId_idx" ON "RfExclusionRange"("venueProfileId");

-- CreateIndex
CREATE INDEX "RfExclusionRange_scanId_idx" ON "RfExclusionRange"("scanId");

-- CreateIndex
CREATE INDEX "RfVenueProfile_organizationId_deletedAt_idx" ON "RfVenueProfile"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "RfVenueProfile_buildingId_idx" ON "RfVenueProfile"("buildingId");

-- CreateIndex
CREATE INDEX "RfVenueProfile_spaceId_idx" ON "RfVenueProfile"("spaceId");

-- CreateIndex
CREATE INDEX "RfVenueProfile_roomId_idx" ON "RfVenueProfile"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RfVenueProfile_organizationId_name_key" ON "RfVenueProfile"("organizationId", "name");

-- CreateIndex
CREATE INDEX "RfBridgeNode_organizationId_status_idx" ON "RfBridgeNode"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RfBridgeNode_organizationId_deletedAt_idx" ON "RfBridgeNode"("organizationId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RfBridgeNode_organizationId_name_key" ON "RfBridgeNode"("organizationId", "name");

-- CreateIndex
CREATE INDEX "RfPlanConflict_organizationId_idx" ON "RfPlanConflict"("organizationId");

-- CreateIndex
CREATE INDEX "RfPlanConflict_planId_idx" ON "RfPlanConflict"("planId");

-- CreateIndex
CREATE INDEX "RfPlanConflict_severity_idx" ON "RfPlanConflict"("severity");

-- CreateIndex
CREATE INDEX "RfRecommendation_organizationId_idx" ON "RfRecommendation"("organizationId");

-- CreateIndex
CREATE INDEX "RfRecommendation_planId_idx" ON "RfRecommendation"("planId");

-- CreateIndex
CREATE INDEX "RfRecommendation_assignmentId_idx" ON "RfRecommendation"("assignmentId");

-- AddForeignKey
ALTER TABLE "WirelessDeviceProfile" ADD CONSTRAINT "WirelessDeviceProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessDeviceProfile" ADD CONSTRAINT "WirelessDeviceProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessDevice" ADD CONSTRAINT "WirelessDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessDevice" ADD CONSTRAINT "WirelessDevice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "WirelessDeviceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessDevice" ADD CONSTRAINT "WirelessDevice_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessDevice" ADD CONSTRAINT "WirelessDevice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_eventProjectId_fkey" FOREIGN KEY ("eventProjectId") REFERENCES "EventProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyPlan" ADD CONSTRAINT "WirelessFrequencyPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyAssignment" ADD CONSTRAINT "WirelessFrequencyAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyAssignment" ADD CONSTRAINT "WirelessFrequencyAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WirelessFrequencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirelessFrequencyAssignment" ADD CONSTRAINT "WirelessFrequencyAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WirelessDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScan" ADD CONSTRAINT "RfScan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScan" ADD CONSTRAINT "RfScan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WirelessFrequencyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScan" ADD CONSTRAINT "RfScan_venueProfileId_fkey" FOREIGN KEY ("venueProfileId") REFERENCES "RfVenueProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScan" ADD CONSTRAINT "RfScan_bridgeNodeId_fkey" FOREIGN KEY ("bridgeNodeId") REFERENCES "RfBridgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScan" ADD CONSTRAINT "RfScan_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScanPoint" ADD CONSTRAINT "RfScanPoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfScanPoint" ADD CONSTRAINT "RfScanPoint_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "RfScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfExclusionRange" ADD CONSTRAINT "RfExclusionRange_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfExclusionRange" ADD CONSTRAINT "RfExclusionRange_venueProfileId_fkey" FOREIGN KEY ("venueProfileId") REFERENCES "RfVenueProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfExclusionRange" ADD CONSTRAINT "RfExclusionRange_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "RfScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfVenueProfile" ADD CONSTRAINT "RfVenueProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfVenueProfile" ADD CONSTRAINT "RfVenueProfile_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfVenueProfile" ADD CONSTRAINT "RfVenueProfile_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfVenueProfile" ADD CONSTRAINT "RfVenueProfile_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfBridgeNode" ADD CONSTRAINT "RfBridgeNode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfBridgeNode" ADD CONSTRAINT "RfBridgeNode_pairedById_fkey" FOREIGN KEY ("pairedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfPlanConflict" ADD CONSTRAINT "RfPlanConflict_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfPlanConflict" ADD CONSTRAINT "RfPlanConflict_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WirelessFrequencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfPlanConflict" ADD CONSTRAINT "RfPlanConflict_assignmentAId_fkey" FOREIGN KEY ("assignmentAId") REFERENCES "WirelessFrequencyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfPlanConflict" ADD CONSTRAINT "RfPlanConflict_assignmentBId_fkey" FOREIGN KEY ("assignmentBId") REFERENCES "WirelessFrequencyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfRecommendation" ADD CONSTRAINT "RfRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfRecommendation" ADD CONSTRAINT "RfRecommendation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WirelessFrequencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfRecommendation" ADD CONSTRAINT "RfRecommendation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WirelessFrequencyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
