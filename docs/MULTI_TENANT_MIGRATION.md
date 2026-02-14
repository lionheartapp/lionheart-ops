# Multi-Tenant Migration Guide

## Task 1 Complete: Schema + Migration

### Schema Changes

`organizationId` (nullable) added to:

- User, Building (index), Ticket, Event, Expense, Budget
- MaintenanceTip, KnowledgeBaseEntry, InventoryItem
- PondLog, PondConfig

### Migration File

`platform/prisma/migrations/20250211000000_add_organization_id_multi_tenant/migration.sql`

### Apply Migration

With a real Postgres database configured in `platform/.env`:

```bash
cd platform
npx prisma migrate deploy
# or for dev: npx prisma migrate dev
```

---

## Task 2.2: Backfill (Run After Migration)

Create a default organization and assign all existing rows to it:

```sql
-- 1. Create default org (adjust name/slug for your school)
INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt")
VALUES ('org_default', 'Your School Name', 'your-school', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 2. Backfill organizationId
UPDATE "User" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Building" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Ticket" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Event" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Expense" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Budget" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "MaintenanceTip" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "KnowledgeBaseEntry" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "InventoryItem" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "PondLog" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "PondConfig" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
```

Use the `id` from your actual Organization row if different. Run via `psql` or Prisma Studio + raw SQL.

---

## Task 2.3: Enforce NOT NULL (Follow-Up Migration)

After backfill, create a new migration to:

- Change `organizationId` from `String?` to `String` on all tenant models
- Update `User` email to `@@unique([organizationId, email])`
- Update `Budget` to `@@unique([organizationId, category, yearMonth])`
- Update `PondConfig` to `@@unique([organizationId, key])`

---

## Next Steps

1. **Task 4.1–4.2:** Tenant context + Next.js middleware (`x-org-id` header)
2. **Task 4.3:** Prisma wrapper with auto-injected `organizationId`
3. **Task 4.4:** Update all API routes to use scoped queries
4. **Task 5:** Frontend — add `x-org-id` to Platform API requests
