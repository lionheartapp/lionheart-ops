# Lionheart Tiered Packaging

Lionheart uses module-based packaging to gate features by subscription tier. Org settings are stored in `Organization.settings` JSON.

## Schema Updates

### Migration (run when DB is available)

```bash
cd platform && npx prisma migrate dev --name add_plan_and_super_admin
```

Or manually:

```sql
-- Add plan to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'CORE';

-- Add SUPER_ADMIN to UserRole enum (PostgreSQL)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'TEACHER';
```

### Organization.plan

- `CORE` (default) — Standard bundle
- `PRO` — Enhanced limits
- `ENTERPRISE` — Full access

### UserRole.SUPER_ADMIN

The first user to sign up (or create an org via Google OAuth) is assigned `SUPER_ADMIN`. Only they see **Manage Subscription** in the sidebar.

## Module Structure

```json
{
  "modules": {
    "core": true,
    "waterManagement": false,
    "visualCampus": { "enabled": true, "maxBuildings": 3 },
    "advancedInventory": true
  }
}
```

| Module | Default | Description |
|--------|---------|-------------|
| **core** | `true` | Core bundle: ticketing, events, forms, AI features, user management |
| **waterManagement** | `false` | Water & Environmental Management (Pond): pH/temp/DO logs, dosage calculator, IoT |
| **visualCampus** | `{ enabled: true }` | 3D map, 360° tours, Matterport, Campus Map link. `maxBuildings` limits scope |
| **advancedInventory** | `false` | Multi-site inventory tracking, shortage alerts during event planning |

## Enabling Modules

Update `Organization.settings` in the database:

```sql
UPDATE "Organization"
SET settings = jsonb_set(
  COALESCE(settings::jsonb, '{}'::jsonb),
  '{modules}',
  '{"core": true, "waterManagement": true, "visualCampus": {"enabled": true}, "advancedInventory": true}'::jsonb
)
WHERE id = 'your-org-id';
```

Or via a future Admin API: `PATCH /api/organization/settings`.

## What Gets Gated

| Module | Lionheart UI | Platform API |
|--------|--------------|--------------|
| waterManagement | Pond widget on Facilities dashboard | `/api/pond-sensor`, `/api/pond/*` (UI-gated only for now) |
| visualCampus | Campus Map link in Sidebar | — |
| advancedInventory | Inventory nav item & Inventory page | — |

## API

- **GET `/api/organization/settings`** — Returns `{ modules }` for the current org (from Bearer token or `x-org-id`).
- Lionheart fetches this on dashboard load and gates UI via `useOrgModules()`.

## Defaults

When `Organization.settings` is null or empty, `getModules()` returns:

- `core: true`
- `waterManagement: false`
- `visualCampus: { enabled: true, maxBuildings: null }`
- `advancedInventory: false`
