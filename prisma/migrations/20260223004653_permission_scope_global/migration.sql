/*
  Warnings:

  - Made the column `scope` on table `Permission` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "scope" SET NOT NULL,
ALTER COLUMN "scope" SET DEFAULT 'global';
