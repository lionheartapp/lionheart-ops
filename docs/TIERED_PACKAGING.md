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

---

## Domain-Based Auto-Join (Google OAuth)

When a user signs in with Google using an email like `teacher@linfield.edu`:

1. **Existing user** → Normal login.
2. **No user + domain match** → Auto-join existing org (role: `TEACHER`).
3. **No user + no match** → Create new org and user (role: `SUPER_ADMIN`).

### Domain Matching

- **allowedDomains** in `Organization.settings`: `["linfield.edu", "linfield.com"]` — users with matching email domains auto-join.
- **website** fallback: if `website` is `https://linfield.edu`, `@linfield.edu` emails can join.

### Add allowedDomains to an existing org

For orgs created before this feature (e.g. Linfield):

```sql
-- Add linfield.com and linfield.edu so staff can auto-join
UPDATE "Organization"
SET settings = jsonb_set(
  COALESCE(settings::jsonb, '{}'::jsonb),
  '{allowedDomains}',
  '["linfield.edu", "linfield.com"]'::jsonb
)
WHERE name ILIKE '%linfield%' OR slug = 'linfield';
```

Replace `linfield` with your school name/slug and the domains you want to allow.

### Fixing a user already in the wrong org

If a user (e.g. `mkerley@linfield.com`) already signed in with Google and was put in a new org:

**Option A — Move user to correct org**

```sql
-- 1. Get Linfield org id
SELECT id, name FROM "Organization" WHERE name ILIKE '%linfield%';

-- 2. Update the user to that org
UPDATE "User"
SET "organizationId" = '<linfield-org-id>'
WHERE email = 'mkerley@linfield.com';
```

**Option B — Delete & re-sign-in (uses domain match)**

```sql
-- Remove the user; next Google sign-in will auto-join via domain
DELETE FROM "User" WHERE email = 'mkerley@linfield.com';
-- Then add allowedDomains to Linfield (see above) and sign in again.
```
