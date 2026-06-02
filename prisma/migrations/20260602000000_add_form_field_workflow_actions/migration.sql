-- AlterTable: Add no-code workflow actions to form fields
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "workflowActions" JSONB;
