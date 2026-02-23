-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL');

-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "schoolType" "SchoolType" NOT NULL DEFAULT 'GLOBAL';
