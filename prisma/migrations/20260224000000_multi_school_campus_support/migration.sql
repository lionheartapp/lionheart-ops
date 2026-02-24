-- CreateEnum for InstitutionType
CREATE TYPE "InstitutionType" AS ENUM ('PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID');

-- AddField to Organization: institutionType
ALTER TABLE "Organization" ADD COLUMN "institutionType" "InstitutionType" NOT NULL DEFAULT 'PUBLIC';

-- AddField to Organization: gradeLevel (will store what schoolType currently has)
ALTER TABLE "Organization" ADD COLUMN "gradeLevel" "SchoolType" NOT NULL DEFAULT 'GLOBAL';

-- AddFields to Organization for Head of Schools (multi-school contact)
ALTER TABLE "Organization" ADD COLUMN "headOfSchoolsTitle" TEXT;
ALTER TABLE "Organization" ADD COLUMN "headOfSchoolsName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "headOfSchoolsEmail" TEXT;
ALTER TABLE "Organization" ADD COLUMN "headOfSchoolsPhone" TEXT;

-- Migrate existing schoolType data to gradeLevel
UPDATE "Organization" SET "gradeLevel" = "schoolType";

-- Drop the old schoolType column
ALTER TABLE "Organization" DROP COLUMN "schoolType";

-- CreateTable School
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" "SchoolType" NOT NULL,
    "principalTitle" TEXT,
    "principalName" TEXT,
    "principalEmail" TEXT,
    "principalPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- AddField to User: schoolId (for multi-school campus assignments)
ALTER TABLE "User" ADD COLUMN "schoolId" TEXT;

-- CreateIndex for School
CREATE UNIQUE INDEX "School_organizationId_name_key" ON "School"("organizationId", "name");
CREATE INDEX "School_organizationId_idx" ON "School"("organizationId");
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- AddForeignKey School to Organization
ALTER TABLE "School" ADD CONSTRAINT "School_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey User.schoolId to School
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
