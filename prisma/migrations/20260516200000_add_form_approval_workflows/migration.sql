-- Baseline IT + approval workflow pieces.
-- This migration originally assumed ITTicket and ApprovalRule already existed
-- in the baselined database. Fresh shadow databases need those core pieces.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITIssueType') THEN
    CREATE TYPE "ITIssueType" AS ENUM ('HARDWARE', 'SOFTWARE', 'ACCOUNT_PASSWORD', 'NETWORK', 'DISPLAY_AV', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITPasswordSubType') THEN
    CREATE TYPE "ITPasswordSubType" AS ENUM ('RESET', 'LOCKED', 'NEW_ACCOUNT', 'PERMISSION_CHANGE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITAVSubType') THEN
    CREATE TYPE "ITAVSubType" AS ENUM ('PROJECTOR', 'SOUNDBOARD', 'DISPLAY', 'APPLE_TV', 'OTHER_AV');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITTicketStatus') THEN
    CREATE TYPE "ITTicketStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITPriority') THEN
    CREATE TYPE "ITPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITHoldReason') THEN
    CREATE TYPE "ITHoldReason" AS ENUM ('PARTS', 'VENDOR', 'USER_AVAILABILITY', 'THIRD_PARTY', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ITTicketSource') THEN
    CREATE TYPE "ITTicketSource" AS ENUM ('AUTHENTICATED', 'MAGIC_LINK', 'SUB_SUBMITTED', 'WEBHOOK');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApprovalRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "module" TEXT NOT NULL DEFAULT 'EVENT',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "schoolId" TEXT,
  "campusId" TEXT,
  "eventCategory" TEXT,
  "minAttendance" INTEGER,
  "requiresResource" TEXT,
  "isOffCampus" BOOLEAN,
  "maintenanceCategory" TEXT,
  "maintenancePriority" TEXT,
  "maintenanceBuildingId" TEXT,
  "maintenanceMinCost" DOUBLE PRECISION,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isFinalApprover" BOOLEAN NOT NULL DEFAULT false,
  "executionMode" TEXT NOT NULL DEFAULT 'PARALLEL',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ITTicket" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ITTicketStatus" NOT NULL DEFAULT 'BACKLOG',
  "issueType" "ITIssueType" NOT NULL,
  "passwordSubType" "ITPasswordSubType",
  "avSubType" "ITAVSubType",
  "priority" "ITPriority" NOT NULL DEFAULT 'MEDIUM',
  "holdReason" "ITHoldReason",
  "holdNote" TEXT,
  "resolutionNote" TEXT,
  "cancellationReason" TEXT,
  "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source" "ITTicketSource" NOT NULL DEFAULT 'AUTHENTICATED',
  "subRoomText" TEXT,
  "subDate" TIMESTAMP(3),
  "buildingId" TEXT,
  "spaceId" TEXT,
  "roomId" TEXT,
  "campusId" TEXT,
  "submittedById" TEXT,
  "assignedToId" TEXT,
  "customFields" JSONB,
  "firstResponseAt" TIMESTAMP(3),
  "slaResponseDue" TIMESTAMP(3),
  "slaResolveDue" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ITTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApprovalRule_organizationId_idx" ON "ApprovalRule"("organizationId");
CREATE INDEX IF NOT EXISTS "ApprovalRule_organizationId_module_idx" ON "ApprovalRule"("organizationId", "module");
CREATE INDEX IF NOT EXISTS "ITTicket_organizationId_status_idx" ON "ITTicket"("organizationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ITTicket_organizationId_ticketNumber_key" ON "ITTicket"("organizationId", "ticketNumber");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalRule_organizationId_fkey') THEN
    ALTER TABLE "ApprovalRule"
      ADD CONSTRAINT "ApprovalRule_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ITTicket_organizationId_fkey') THEN
    ALTER TABLE "ITTicket"
      ADD CONSTRAINT "ITTicket_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterEnum: Add PENDING_APPROVAL to ITTicketStatus
ALTER TYPE "ITTicketStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- AlterTable: Add formDefinitionId to ApprovalRule
ALTER TABLE "ApprovalRule" ADD COLUMN "formDefinitionId" TEXT;

-- AlterTable: Add approval fields to ITTicket
ALTER TABLE "ITTicket" ADD COLUMN "approvalGates" JSONB;
ALTER TABLE "ITTicket" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "ITTicket" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "ITTicket" ADD COLUMN "rejectionReason" TEXT;

-- AddForeignKey: ApprovalRule -> FormDefinition
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_formDefinitionId_fkey"
  FOREIGN KEY ("formDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ITTicket -> User (approvedBy)
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ApprovalRule_organizationId_formDefinitionId_idx" ON "ApprovalRule"("organizationId", "formDefinitionId");
CREATE INDEX "ApprovalRule_formDefinitionId_idx" ON "ApprovalRule"("formDefinitionId");
