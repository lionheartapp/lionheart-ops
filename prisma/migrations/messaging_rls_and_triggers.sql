-- Phase 23-03: Messaging RLS policies, unread counter triggers, and tsvector search
-- Applied manually via Supabase SQL Editor or psql (not via Prisma migrate)
-- Depends on: Phase 23-01 schema (8 messaging tables must exist)

-- =============================================================================
-- Section 1: JWT claim helper functions
-- =============================================================================
-- Claim names MUST match what Phase 25 /api/realtime/token endpoint will produce
-- Using camelCase: organizationId, userId (matching app JWT payload)
-- SECURITY DEFINER avoids circular RLS on ChannelMember (Pitfall 5)

CREATE OR REPLACE FUNCTION messaging_org_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'organizationId'
$$;

CREATE OR REPLACE FUNCTION messaging_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'userId'
$$;

-- =============================================================================
-- Section 2: Enable RLS on all 8 messaging tables
-- =============================================================================
-- Prisma connects as postgres/service_role which bypasses RLS by default.
-- If using a non-superuser role for Prisma, add: GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- No action needed if DATABASE_URL connects as postgres user (Supabase default).

ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageMention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessagingNotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Section 3: RLS policies
-- =============================================================================
-- Belt-and-suspenders (D-03): Prisma org-scoping + RLS for defense in depth
-- Channel membership isolation (D-04): Message/Channel SELECT requires ChannelMember join

-- -----------------------------------------------------------------------------
-- Channel: SELECT requires org match AND user is a member
-- -----------------------------------------------------------------------------
CREATE POLICY "channel_select" ON "Channel"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "ChannelMember"
      WHERE "ChannelMember"."channelId" = "Channel"."id"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

CREATE POLICY "channel_insert" ON "Channel"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "channel_update" ON "Channel"
  FOR UPDATE TO authenticated
  USING ("organizationId" = messaging_org_id())
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "channel_delete" ON "Channel"
  FOR DELETE TO authenticated
  USING ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- ChannelMember: SELECT requires org match only (avoids circular RLS)
-- -----------------------------------------------------------------------------
CREATE POLICY "channelmember_select" ON "ChannelMember"
  FOR SELECT TO authenticated
  USING ("organizationId" = messaging_org_id());

CREATE POLICY "channelmember_insert" ON "ChannelMember"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "channelmember_delete" ON "ChannelMember"
  FOR DELETE TO authenticated
  USING ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- Message: SELECT requires org match AND user is a member of the channel
-- -----------------------------------------------------------------------------
CREATE POLICY "message_select" ON "Message"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "ChannelMember"
      WHERE "ChannelMember"."channelId" = "Message"."channelId"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

CREATE POLICY "message_insert" ON "Message"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "message_update" ON "Message"
  FOR UPDATE TO authenticated
  USING ("organizationId" = messaging_org_id())
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "message_delete" ON "Message"
  FOR DELETE TO authenticated
  USING ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- MessageReaction: org match + channel membership (via message's channel)
-- -----------------------------------------------------------------------------
CREATE POLICY "messagereaction_select" ON "MessageReaction"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "Message"
      JOIN "ChannelMember" ON "ChannelMember"."channelId" = "Message"."channelId"
      WHERE "Message"."id" = "MessageReaction"."messageId"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

CREATE POLICY "messagereaction_insert" ON "MessageReaction"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

CREATE POLICY "messagereaction_delete" ON "MessageReaction"
  FOR DELETE TO authenticated
  USING ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- MessageAttachment: org match + channel membership (via message's channel)
-- -----------------------------------------------------------------------------
CREATE POLICY "messageattachment_select" ON "MessageAttachment"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "Message"
      JOIN "ChannelMember" ON "ChannelMember"."channelId" = "Message"."channelId"
      WHERE "Message"."id" = "MessageAttachment"."messageId"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

CREATE POLICY "messageattachment_insert" ON "MessageAttachment"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- MessageMention: org match + channel membership (via message's channel)
-- -----------------------------------------------------------------------------
CREATE POLICY "messagemention_select" ON "MessageMention"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND EXISTS (
      SELECT 1 FROM "Message"
      JOIN "ChannelMember" ON "ChannelMember"."channelId" = "Message"."channelId"
      WHERE "Message"."id" = "MessageMention"."messageId"
        AND "ChannelMember"."userId" = messaging_user_id()
    )
  );

CREATE POLICY "messagemention_insert" ON "MessageMention"
  FOR INSERT TO authenticated
  WITH CHECK ("organizationId" = messaging_org_id());

-- -----------------------------------------------------------------------------
-- MessagingNotificationPreference: org match + own rows only
-- (Renamed from NotificationPreference per Plan 01 deviation)
-- -----------------------------------------------------------------------------
CREATE POLICY "msgnotifpref_select" ON "MessagingNotificationPreference"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

CREATE POLICY "msgnotifpref_insert" ON "MessagingNotificationPreference"
  FOR INSERT TO authenticated
  WITH CHECK (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

CREATE POLICY "msgnotifpref_update" ON "MessagingNotificationPreference"
  FOR UPDATE TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

CREATE POLICY "msgnotifpref_delete" ON "MessagingNotificationPreference"
  FOR DELETE TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

-- -----------------------------------------------------------------------------
-- PushSubscription: org match + own rows only
-- -----------------------------------------------------------------------------
CREATE POLICY "pushsubscription_select" ON "PushSubscription"
  FOR SELECT TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

CREATE POLICY "pushsubscription_insert" ON "PushSubscription"
  FOR INSERT TO authenticated
  WITH CHECK (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

CREATE POLICY "pushsubscription_delete" ON "PushSubscription"
  FOR DELETE TO authenticated
  USING (
    "organizationId" = messaging_org_id()
    AND "userId" = messaging_user_id()
  );

-- =============================================================================
-- Section 4: Unread counter triggers
-- =============================================================================

-- Increment unread count for all channel members except the message author
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "ChannelMember"
  SET "unreadCount" = "unreadCount" + 1
  WHERE "channelId" = NEW."channelId"
    AND "userId" != NEW."authorId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_increment_unread
  AFTER INSERT ON "Message"
  FOR EACH ROW
  WHEN (NEW."deletedAt" IS NULL)
  EXECUTE FUNCTION increment_unread_count();

-- Reset unread count to 0 when lastReadAt is updated (user opens channel)
-- Uses BEFORE UPDATE so we can modify NEW directly (avoids a second write)
CREATE OR REPLACE FUNCTION reset_unread_on_read()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."lastReadAt" IS DISTINCT FROM OLD."lastReadAt" THEN
    NEW."unreadCount" := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER channelmember_reset_unread
  BEFORE UPDATE ON "ChannelMember"
  FOR EACH ROW
  EXECUTE FUNCTION reset_unread_on_read();

-- =============================================================================
-- Section 5: Full-text search tsvector trigger and GIN index
-- =============================================================================

-- GIN index on Message.searchVector for full-text search
CREATE INDEX IF NOT EXISTS "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");

-- Populate searchVector on insert or content update
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', COALESCE(NEW."content", ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_search_vector_update
  BEFORE INSERT OR UPDATE OF "content" ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION update_message_search_vector();
