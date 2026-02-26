-- Remove the deprecated `role` column from User.
-- All role information is now managed through the Role table via `roleId`.
-- The UserRole enum is also removed as it is no longer referenced.

ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "UserRole";
