-- Extended inventory fields (run in Supabase SQL Editor if not using prisma db push)
-- Idempotent: ADD COLUMN IF NOT EXISTS.

-- InventoryItem: description, owner, checkout, product details, media, tags
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "ownerId" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "allowCheckout" boolean NOT NULL DEFAULT false;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "checkoutCategory" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "manufacturer" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "serialNumbers" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "documentationLinks" text;
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "tags" text;

CREATE INDEX IF NOT EXISTS "InventoryItem_ownerId_idx" ON "InventoryItem"("ownerId");

-- InventoryStock: usageNotes
ALTER TABLE "InventoryStock"
  ADD COLUMN IF NOT EXISTS "usageNotes" text;
