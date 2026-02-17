-- Enable Row Level Security (RLS) on all public tables exposed to PostgREST.
-- This clears "RLS Disabled in Public" security audit errors.
--
-- Your app uses Prisma with a single DB connection (e.g. postgres or pooler user).
-- In Supabase, that role often bypasses RLS (superuser/owner), so the app keeps
-- working. Direct PostgREST access via anon/authenticated keys will see no rows
-- until you add policies for those roles.
--
-- If your Prisma connection uses a role that does NOT bypass RLS, add policies
-- for that role (e.g. USING (true) / WITH CHECK (true)) so the backend retains
-- access.

ALTER TABLE "public"."Organization"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Team"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Building"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Room"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TeacherSchedule"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Ticket"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Event"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Expense"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Budget"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Form"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FormSubmission"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MaintenanceTip"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KnowledgeBaseEntry"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InventoryItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InventoryStock"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WaterAsset"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WaterLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WaterAssetConfig"    ENABLE ROW LEVEL SECURITY;
