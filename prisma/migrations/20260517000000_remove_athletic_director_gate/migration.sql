-- DropColumn: remove requiresAthleticDirector from EventProject
ALTER TABLE "EventProject" DROP COLUMN IF EXISTS "requiresAthleticDirector";

-- Note: The ATHLETIC_DIRECTOR value in ResourceRequestType enum is left in place.
-- Postgres cannot drop enum values directly without recreating the type.
-- Since no code references it anymore, it's harmless dead weight.
-- A future migration can clean it up with a full enum rebuild if desired.
