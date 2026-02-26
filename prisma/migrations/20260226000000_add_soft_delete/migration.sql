-- Add soft-delete (deletedAt) to main business models
-- When deletedAt IS NOT NULL, the record is considered deleted.
-- The application layer (db/index.ts) automatically filters these out on all reads.

ALTER TABLE "User"          ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Ticket"        ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Event"         ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "DraftEvent"    ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "InventoryItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Building"      ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Area"          ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Room"          ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "School"        ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Indexes for fast filtering of active (non-deleted) records
CREATE INDEX "User_organizationId_deletedAt_idx"          ON "User"          ("organizationId", "deletedAt");
CREATE INDEX "Ticket_organizationId_deletedAt_idx"        ON "Ticket"        ("organizationId", "deletedAt");
CREATE INDEX "Event_organizationId_deletedAt_idx"         ON "Event"         ("organizationId", "deletedAt");
CREATE INDEX "DraftEvent_organizationId_deletedAt_idx"    ON "DraftEvent"    ("organizationId", "deletedAt");
CREATE INDEX "InventoryItem_organizationId_deletedAt_idx" ON "InventoryItem" ("organizationId", "deletedAt");
CREATE INDEX "Building_organizationId_deletedAt_idx"      ON "Building"      ("organizationId", "deletedAt");
CREATE INDEX "Area_organizationId_deletedAt_idx"          ON "Area"          ("organizationId", "deletedAt");
CREATE INDEX "Room_organizationId_deletedAt_idx"          ON "Room"          ("organizationId", "deletedAt");
CREATE INDEX "School_organizationId_deletedAt_idx"        ON "School"        ("organizationId", "deletedAt");
