-- Baseline forms core.
-- This migration was created after the original forms tables already existed
-- in the baseline database, so fresh shadow databases need the core pieces
-- created before the ALTER statements below run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublicFormStyle') THEN
    CREATE TYPE "PublicFormStyle" AS ENUM ('MINIMAL', 'SPLIT', 'HERO');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FormImageSide') THEN
    CREATE TYPE "FormImageSide" AS ENUM ('LEFT', 'RIGHT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FormFieldType') THEN
    CREATE TYPE "FormFieldType" AS ENUM (
      'TEXT',
      'TEXTAREA',
      'NUMBER',
      'DATE',
      'EMAIL',
      'PHONE',
      'DROPDOWN',
      'MULTI_SELECT',
      'CHECKBOX',
      'FILE',
      'SIGNATURE',
      'ASSET_PICKER',
      'USER_PICKER',
      'LOCATION_PICKER',
      'GRADE_SELECTOR'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FormDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "categoryKey" TEXT,
  "eventId" TEXT,
  "publicStyle" "PublicFormStyle" NOT NULL DEFAULT 'MINIMAL',
  "publicCtaColor" TEXT,
  "publicBgColor" TEXT,
  "publicImageUrl" TEXT,
  "publicImageSide" "FormImageSide" NOT NULL DEFAULT 'RIGHT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormSection" (
  "id" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormField" (
  "id" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "sectionId" TEXT,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "FormFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "placeholder" TEXT,
  "helpText" TEXT,
  "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "autoEscalate" BOOLEAN NOT NULL DEFAULT false,
  "condFieldKey" TEXT,
  "condEquals" TEXT,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FormDefinition_eventId_key" ON "FormDefinition"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "FormDefinition_organizationId_categoryKey_key" ON "FormDefinition"("organizationId", "categoryKey");
CREATE INDEX IF NOT EXISTS "FormDefinition_organizationId_eventId_idx" ON "FormDefinition"("organizationId", "eventId");
CREATE INDEX IF NOT EXISTS "FormSection_formId_idx" ON "FormSection"("formId");
CREATE INDEX IF NOT EXISTS "FormField_formId_idx" ON "FormField"("formId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormDefinition_organizationId_fkey') THEN
    ALTER TABLE "FormDefinition"
      ADD CONSTRAINT "FormDefinition_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormDefinition_eventId_fkey') THEN
    ALTER TABLE "FormDefinition"
      ADD CONSTRAINT "FormDefinition_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormSection_formId_fkey') THEN
    ALTER TABLE "FormSection"
      ADD CONSTRAINT "FormSection_formId_fkey"
      FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormField_formId_fkey') THEN
    ALTER TABLE "FormField"
      ADD CONSTRAINT "FormField_formId_fkey"
      FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormField_sectionId_fkey') THEN
    ALTER TABLE "FormField"
      ADD CONSTRAINT "FormField_sectionId_fkey"
      FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "FormContext" AS ENUM ('TICKET_CATEGORY', 'EVENT_REGISTRATION', 'EVENT_CREATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FieldProtection" AS ENUM ('LOCKED', 'DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FieldSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'FERPA_PROTECTED');

-- CreateEnum
CREATE TYPE "FormActionType" AS ENUM ('CREATE_RECORD', 'NOTIFY', 'REQUIRE_APPROVAL', 'WEBHOOK', 'REDIRECT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FormFieldType" ADD VALUE 'TIME';
ALTER TYPE "FormFieldType" ADD VALUE 'URL';
ALTER TYPE "FormFieldType" ADD VALUE 'RADIO';
ALTER TYPE "FormFieldType" ADD VALUE 'RATING';
ALTER TYPE "FormFieldType" ADD VALUE 'SCALE';
ALTER TYPE "FormFieldType" ADD VALUE 'HEADER';
ALTER TYPE "FormFieldType" ADD VALUE 'DIVIDER';

-- AlterTable
ALTER TABLE "FormDefinition" ADD COLUMN     "allowDrafts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoSave" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirmMessage" TEXT,
ADD COLUMN     "context" "FormContext" NOT NULL DEFAULT 'TICKET_CATEGORY',
ADD COLUMN     "coverColor" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentTemplateId" TEXT,
ADD COLUMN     "redirectUrl" TEXT,
ADD COLUMN     "requireEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "condOperator" TEXT,
ADD COLUMN     "defaultValue" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "fileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxFileSize" INTEGER,
ADD COLUMN     "maxValue" TEXT,
ADD COLUMN     "minValue" TEXT,
ADD COLUMN     "pageId" TEXT,
ADD COLUMN     "pattern" TEXT,
ADD COLUMN     "prefillSource" TEXT,
ADD COLUMN     "protection" "FieldProtection" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "sensitivityLevel" "FieldSensitivity" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "FormPage" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "condFieldKey" TEXT,
    "condOperator" TEXT,
    "condEquals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAction" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "actionType" "FormActionType" NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "submittedBy" TEXT,
    "submitterName" TEXT,
    "submitterEmail" TEXT,
    "data" JSONB NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "draftExpiresAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "category" TEXT,
    "fieldSnapshot" JSONB NOT NULL,
    "styleSnapshot" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormPage_formId_idx" ON "FormPage"("formId");

-- CreateIndex
CREATE INDEX "FormAction_formId_idx" ON "FormAction"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_organizationId_idx" ON "FormSubmission"("organizationId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_organizationId_status_idx" ON "FormSubmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FormTemplate_organizationId_idx" ON "FormTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "FormDefinition_organizationId_context_idx" ON "FormDefinition"("organizationId", "context");

-- CreateIndex
CREATE INDEX "FormDefinition_organizationId_systemKey_idx" ON "FormDefinition"("organizationId", "systemKey");

-- AddForeignKey
ALTER TABLE "FormPage" ADD CONSTRAINT "FormPage_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FormPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAction" ADD CONSTRAINT "FormAction_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
