-- Multi-tenant: Add organizationId to tenant-scoped models
-- All columns nullable for backward compatibility; backfill required before enforcing NOT NULL

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Building (organizationId may already exist; ensure index and FK)
CREATE INDEX IF NOT EXISTS "Building_organizationId_idx" ON "Building"("organizationId");

-- Ticket
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Ticket_organizationId_idx" ON "Ticket"("organizationId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Event_organizationId_idx" ON "Event"("organizationId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Expense_organizationId_idx" ON "Expense"("organizationId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Budget
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Budget_organizationId_idx" ON "Budget"("organizationId");
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MaintenanceTip
ALTER TABLE "MaintenanceTip" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "MaintenanceTip_organizationId_idx" ON "MaintenanceTip"("organizationId");
ALTER TABLE "MaintenanceTip" ADD CONSTRAINT "MaintenanceTip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KnowledgeBaseEntry
ALTER TABLE "KnowledgeBaseEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "KnowledgeBaseEntry_organizationId_idx" ON "KnowledgeBaseEntry"("organizationId");
ALTER TABLE "KnowledgeBaseEntry" ADD CONSTRAINT "KnowledgeBaseEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PondLog
ALTER TABLE "PondLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "PondLog_organizationId_idx" ON "PondLog"("organizationId");
ALTER TABLE "PondLog" ADD CONSTRAINT "PondLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PondConfig
ALTER TABLE "PondConfig" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "PondConfig_organizationId_idx" ON "PondConfig"("organizationId");
ALTER TABLE "PondConfig" ADD CONSTRAINT "PondConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
