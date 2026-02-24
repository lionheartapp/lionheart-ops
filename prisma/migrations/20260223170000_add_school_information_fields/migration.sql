-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "physicalAddress" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "principalTitle" TEXT,
ADD COLUMN "principalName" TEXT,
ADD COLUMN "principalEmail" TEXT,
ADD COLUMN "principalPhone" TEXT,
ADD COLUMN "gradeRange" TEXT,
ADD COLUMN "studentCount" INTEGER,
ADD COLUMN "staffCount" INTEGER;
