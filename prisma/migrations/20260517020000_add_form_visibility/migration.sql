-- CreateEnum
CREATE TYPE "FormVisibility" AS ENUM ('PRIVATE', 'SHARED');

-- AlterTable
ALTER TABLE "FormDefinition" ADD COLUMN "visibility" "FormVisibility" NOT NULL DEFAULT 'PRIVATE';
