-- Phase 25-01: Messaging broadcast trigger for Supabase Realtime
-- Applied manually via Supabase SQL Editor or psql (not via Prisma migrate)
-- Depends on: Phase 23 messaging schema + Phase 23 RLS policies

-- =============================================================================
-- Section 1: Broadcast function
-- =============================================================================
-- Publishes new messages to Supabase Realtime via realtime.send().
-- Topic: msg:{orgId}:{channelId} — includes org prefix for cross-tenant isolation.
-- Event: new_message — clients subscribe to this event name.
-- Payload: full message row as JSONB so clients can render without a follow-up fetch.

CREATE OR REPLACE FUNCTION broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM realtime.send(
    'msg:' || NEW."organizationId" || ':' || NEW."channelId",
    'new_message',
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Section 2: Trigger binding
-- =============================================================================
-- AFTER INSERT so the row is committed before broadcast.
-- WHEN guard excludes soft-deleted rows (matching Phase 23 convention).

-- NOTE: Execute this SQL in Supabase SQL Editor after verifying realtime.send()
-- is available on your Supabase project version.

CREATE TRIGGER message_broadcast_on_insert
  AFTER INSERT ON "Message"
  FOR EACH ROW
  WHEN (NEW."deletedAt" IS NULL)
  EXECUTE FUNCTION broadcast_new_message();
