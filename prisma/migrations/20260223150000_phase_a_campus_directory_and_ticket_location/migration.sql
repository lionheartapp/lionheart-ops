-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('MAINTENANCE', 'IT', 'EVENT');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LocationRefType" AS ENUM ('ROOM', 'AREA', 'BUILDING', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "SchoolDivision" AS ENUM ('ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL');

-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'OTHER');

-- AlterTable
ALTER TABLE "Ticket"
ADD COLUMN "category" "TicketCategory" NOT NULL DEFAULT 'MAINTENANCE',
ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "locationRefType" "LocationRefType",
ADD COLUMN "locationRefId" TEXT,
ADD COLUMN "locationText" TEXT;

-- CreateTable
CREATE TABLE "Building" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "schoolDivision" "SchoolDivision" NOT NULL DEFAULT 'GLOBAL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "buildingId" TEXT,
  "name" TEXT NOT NULL,
  "areaType" "AreaType" NOT NULL DEFAULT 'OTHER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "areaId" TEXT,
  "roomNumber" TEXT NOT NULL,
  "displayName" TEXT,
  "floor" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoomAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserRoomAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_organizationId_category_idx" ON "Ticket"("organizationId", "category");

-- CreateIndex
CREATE INDEX "Ticket_organizationId_priority_idx" ON "Ticket"("organizationId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Building_organizationId_name_key" ON "Building"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_organizationId_code_key" ON "Building"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Building_organizationId_isActive_idx" ON "Building"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Area_organizationId_buildingId_name_key" ON "Area"("organizationId", "buildingId", "name");

-- CreateIndex
CREATE INDEX "Area_organizationId_isActive_idx" ON "Area"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Area_buildingId_idx" ON "Area"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_buildingId_roomNumber_key" ON "Room"("organizationId", "buildingId", "roomNumber");

-- CreateIndex
CREATE INDEX "Room_organizationId_isActive_idx" ON "Room"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Room_buildingId_idx" ON "Room"("buildingId");

-- CreateIndex
CREATE INDEX "Room_areaId_idx" ON "Room"("areaId");

-- CreateIndex
CREATE INDEX "UserRoomAssignment_organizationId_userId_idx" ON "UserRoomAssignment"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "UserRoomAssignment_organizationId_roomId_idx" ON "UserRoomAssignment"("organizationId", "roomId");

-- CreateIndex
CREATE INDEX "UserRoomAssignment_isActive_idx" ON "UserRoomAssignment"("isActive");

-- AddForeignKey
ALTER TABLE "Building"
ADD CONSTRAINT "Building_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area"
ADD CONSTRAINT "Area_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area"
ADD CONSTRAINT "Area_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room"
ADD CONSTRAINT "Room_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room"
ADD CONSTRAINT "Room_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room"
ADD CONSTRAINT "Room_areaId_fkey"
FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoomAssignment"
ADD CONSTRAINT "UserRoomAssignment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoomAssignment"
ADD CONSTRAINT "UserRoomAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoomAssignment"
ADD CONSTRAINT "UserRoomAssignment_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
