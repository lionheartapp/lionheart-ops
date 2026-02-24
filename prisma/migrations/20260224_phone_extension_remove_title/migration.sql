-- Remove principalTitle from School (not needed - always "Principal")
-- Add principalPhoneExt for phone extensions

ALTER TABLE "School" DROP COLUMN IF EXISTS "principalTitle";
ALTER TABLE "School" ADD COLUMN "principalPhoneExt" TEXT;

-- Also remove from Organization since it's not used in multi-school context
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "principalTitle";
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "headOfSchoolsTitle";
