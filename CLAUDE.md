# Lionheart Platform — CLAUDE.md

Educational institution management SaaS. Multi-tenant Next.js 15 app with one Supabase/PostgreSQL database shared across all organizations, isolated by `organizationId`.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma v5.22 |
| Auth | JWT (jose, HS256, 30-day expiry) |
| Email | Resend (via nodemailer adapter) |
| AI | Google Gemini (`@google/genai`) |
| UI | React 18, Tailwind CSS, TanStack Query |
| Validation | Zod |

Dev server runs on **port 3004**: `npm run dev`

---

## Environment Variables

```
DATABASE_URL      # Pooled Supabase connection (transactions/queries)
DIRECT_URL        # Direct Supabase connection (migrations/introspection)
AUTH_SECRET       # JWT signing secret — must be long and random
GEMINI_API_KEY    # Optional — enables AI features
RESEND_API_KEY    # Optional — enables welcome emails
MAIL_FROM         # Optional — sender address (default: no-reply@lionheartapp.com)
```

`.env` = remote/production. `.env.local` = local dev (takes precedence for db:* scripts).

Generate a secret: `npm run auth:secret`

---

## Database Commands

```bash
npm run db:push          # Push schema to local DB (no migration file)
npm run db:push:remote   # Push schema to remote/production DB
npm run db:migrate       # Create + apply migration locally
npm run db:migrate:remote # Apply pending migrations to production
npm run db:studio        # Open Prisma Studio (local)
npm run db:seed          # Seed demo data (local)
npm run db:seed:remote   # Seed demo data (remote)
```

**Always run these from the project root, not `~`.**

When making schema changes, prefer `db:push` for quick iteration locally, then create a proper migration file before touching production.

---

## Architecture

### Multi-Tenancy

Every request carries an `organizationId`. The flow is:

1. **Middleware** (`src/middleware.ts`) — verifies the JWT and injects `x-org-id` header onto the request. Public paths bypass this.
2. **Route handler** calls `getOrgIdFromRequest(req)` to read `x-org-id`.
3. Route wraps its DB work in `runWithOrgContext(orgId, async () => { ... })`.
4. Inside that callback, the org-scoped Prisma client (`prisma` from `@/lib/db`) **automatically** injects `organizationId` into every query and create.

**Never use `rawPrisma` inside a route handler** unless you have a specific reason to bypass org scoping (e.g., looking up a user by JWT during auth). Always use the named export `prisma`.

```
src/lib/org-context.ts   — AsyncLocalStorage store + runWithOrgContext / getOrgContextId
src/lib/db/index.ts      — rawPrisma (unscoped) + orgScopedPrisma exported as `prisma`
```

### Prisma Client Exports

```typescript
import { prisma }    from '@/lib/db'  // org-scoped + soft-delete aware — USE THIS in routes
import { rawPrisma } from '@/lib/db'  // unscoped — only for auth/registration/migrations
```

### Auto-Injected Behaviors (db/index.ts extension)

**Org-scoped models** (auto-inject `organizationId` on create, filter on reads):
`User, Ticket, Event, DraftEvent, InventoryItem, TeacherSchedule, Building, Area, Room, UserRoomAssignment`

**Soft-delete models** (`.delete()` → stamps `deletedAt`, reads auto-filter `deletedAt: null`):
`User, Ticket, Event, DraftEvent, InventoryItem, Building, Area, Room, School`

`UserTeam`, `Role`, `Permission`, `Team` are **not** org-scoped by the extension — their security comes from being associated with org-scoped parents.

---

## Authentication

**File:** `src/lib/auth.ts` (canonical — do not use `src/lib/auth/index.ts`, it was deleted as dead code)

```typescript
signAuthToken({ userId, organizationId, email })  // returns 30-day JWT
verifyAuthToken(token)                             // returns AuthClaims | null
```

JWT payload: `{ userId, organizationId, email }`

**User context in routes:**

```typescript
import { getUserContext } from '@/lib/request-context'

const ctx = await getUserContext(req)
// ctx.userId, ctx.organizationId, ctx.email, ctx.roleName
```

`getUserContext` uses `rawPrisma` internally (bypasses org-scope) — this is intentional and correct.

---

## Permission System

### Definitions (`src/lib/permissions.ts`)

Permission strings follow `resource:action` or `resource:action:scope`.

```typescript
PERMISSIONS.TICKETS_READ_ALL   // "tickets:read:all"
PERMISSIONS.EVENTS_APPROVE     // "events:approve"
PERMISSIONS.ALL                // "*:*"  (super-admin wildcard)
```

`DEFAULT_ROLES` defines 4 built-in roles: `super-admin`, `admin`, `member`, `viewer`.
`DEFAULT_TEAMS` defines 5 built-in teams: IT Support, Facility Maintenance, A/V Production, Teachers, Administration.

### Checking Permissions (`src/lib/auth/permissions.ts`)

```typescript
import { assertCan, can, canAny } from '@/lib/auth/permissions'

await assertCan(ctx.userId, PERMISSIONS.USERS_INVITE)   // throws if denied
const ok = await can(ctx.userId, PERMISSIONS.EVENTS_APPROVE)  // returns bool
```

Results are cached per-user for 30 seconds. Call `clearPermissionCache(userId)` after role changes.

### DB Schema

- `Permission` — global reference table (no `organizationId`). Rows are upserted on first org signup and reused. Stored as `{ resource, action, scope }` — reconstructed to `resource:action[:scope]` strings at runtime.
- `Role` — org-scoped. Each org gets its own copy of the 4 system roles.
- `RolePermission` — junction table linking roles to permissions.
- `User.roleId` → `Role.id` — a user has exactly one role.

### Team Membership

Teams use a junction table (not arrays):

```
UserTeam { userId, teamId, createdAt }  @@id([userId, teamId])
```

`getUserTeams(userId)` returns an array of **team IDs** (UUIDs). Team membership is used for scope-based permission checks (`canAccessResource`).

---

## API Route Pattern

Every route follows the same boilerplate:

```typescript
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)      // read x-org-id header
    const ctx = await getUserContext(req)        // verify JWT, get userId
    await assertCan(ctx.userId, PERMISSIONS.XXX) // enforce permission

    return await runWithOrgContext(orgId, async () => {
      const data = await prisma.someModel.findMany({ ... })
      return NextResponse.json(ok(data))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
```

**Response envelope** (`src/lib/api-response.ts`):

```typescript
ok(data)                        // { ok: true, data }
fail('CODE', 'message')         // { ok: false, error: { code, message } }
fail('CODE', 'msg', details)    // with optional details array
```

### Public API Paths (no auth required)

```
/api/auth/login
/api/auth/set-password
/api/branding
/api/organizations/slug-check
/api/organizations/signup
```

---

## Org Registration Flow

`src/lib/services/organizationRegistrationService.ts`

`createOrganization(input)` does three things in sequence:
1. Creates the `Organization` + first admin `User` (status: `ACTIVE`)
2. Calls `seedOrgDefaults(orgId)` — upserts all `Permission` rows, creates org-scoped `Role` and `Team` records
3. Updates the admin user's `roleId` to the `super-admin` role

`seedOrgDefaults(orgId)` is also exported for use in scripts/migrations if you need to backfill an existing org.

---

## Data Models (Prisma Schema)

```
Organization          — top-level tenant; has slug for subdomain routing
User                  — org-scoped, soft-delete; roleId → Role
Role                  — org-scoped; has permissions via RolePermission
Permission            — global (no orgId); unique on (resource, action, scope)
RolePermission        — junction: Role ↔ Permission
Team                  — org-scoped
UserTeam              — junction: User ↔ Team (replaces old teamIds string[])
Ticket                — org-scoped, soft-delete; has schoolId, locationRef
Building              — org-scoped, soft-delete; has schoolId
Area                  — org-scoped, soft-delete; belongs to Building
Room                  — org-scoped, soft-delete; belongs to Area or Building
School                — org-scoped, soft-delete; gradeLevel enum
Event                 — org-scoped, soft-delete
DraftEvent            — org-scoped, soft-delete
InventoryItem         — org-scoped, soft-delete
TeacherSchedule       — org-scoped
UserRoomAssignment    — org-scoped
PasswordSetupToken    — used for invite/setup-password flow
```

### Soft-Delete Gotcha

`prisma.user.delete(...)` does **not** delete the row — it sets `deletedAt`. This is transparent to callers. If you genuinely need a hard delete (e.g., in tests or admin scripts), use `rawPrisma` directly.

---

## File Structure

```
src/
  app/
    api/
      auth/          login, set-password, permissions, profile/avatar
      organizations/ signup, slug-check
      settings/
        users/       CRUD for org members
        roles/       CRUD for roles
        teams/       CRUD for teams + member management
        permissions/ list all permissions
        campus/      buildings, areas, rooms
        schools/     multi-school management
        school-info/ org-level info (principal, grade range, etc.)
        principals/  principal management
      tickets/       ticket CRUD
      events/        published events
      draft-events/  draft event workflow
      inventory/     inventory items
      campus/lookup  public campus lookup
      branding/      public org branding endpoint
    [tenant]/        subdomain-based tenant layout
    login/           login page
    set-password/    password setup page
    settings/        settings page
    dashboard/
  lib/
    auth.ts              JWT sign/verify (canonical — not auth/index.ts)
    auth/
      permissions.ts     can(), assertCan(), getUserTeams(), isOnTeam()
      password-setup.ts  setup token generation/validation
    db/index.ts          rawPrisma + orgScopedPrisma (exported as `prisma`)
    org-context.ts       AsyncLocalStorage for org ID propagation
    request-context.ts   getUserContext() — reads JWT + fetches user
    api-response.ts      ok() / fail() envelope helpers
    permissions.ts       PERMISSIONS constants, DEFAULT_ROLES, DEFAULT_TEAMS
    services/
      organizationRegistrationService.ts  signup + seedOrgDefaults
      organizationService.ts
      ticketService.ts
      eventService.ts / draftEventService.ts
      emailService.ts     Resend-backed welcome emails
      ai/gemini.service.ts
      facilities.service.ts
      settings.service.ts
      tenant.service.ts
  middleware.ts      JWT verification + x-org-id injection
  components/
    settings/        CampusTab, MembersTab, RolesTab, TeamsTab, SchoolsManagement, SchoolInfoTab
    DashboardLayout, Sidebar, DetailDrawer, ConfirmDialog, etc.
prisma/
  schema.prisma
  migrations/
  seed.ts
scripts/
  smoke-*.mjs          Integration smoke tests (run against live API)
  check-*.mjs          Architecture + env validation scripts
  setup-admin.mjs      One-off admin setup
```

---

## Conventions

### Always use `rawPrisma` for:
- Auth token verification lookups (`getUserContext`)
- Organization signup / `seedOrgDefaults`
- Scripts and one-off migrations

### Always use `prisma` (org-scoped) for:
- Everything inside a `runWithOrgContext(orgId, ...)` block in route handlers

### Zod validation
All route inputs are validated with Zod before touching the DB. Validation errors return `fail('VALIDATION_ERROR', ...)` with `{ status: 400 }`.

### Compound unique constraints
`User` has `@@unique([organizationId, email])`. When updating a user by ID, look up their current email first and use `organizationId_email` as the `where` key — never just `{ id }` unless the model uses a simple `@id`.

### Slug updates don't cascade
Team slugs are stored only on the `Team` record. `UserTeam` references `teamId` (UUID), so renaming a team requires no user updates.

### Permission cache
`getUserPermissions` is cached 30 seconds in-memory. Always call `clearPermissionCache(userId)` after changing a user's role.

---

## Common Pitfalls

**Wrong Prisma client** — Using `rawPrisma` inside a route handler skips org-scoping silently. Always use `prisma` inside `runWithOrgContext`.

**Module resolution** — `@/lib/auth` resolves to `auth.ts`, not `auth/index.ts`. There is no `auth/index.ts`.

**Soft-delete bypass** — Need to query deleted records? Use `rawPrisma` and add `deletedAt: { not: null }` manually.

**`$transaction` with org-scoped client** — Prisma interactive transactions on the extended client can behave unexpectedly. Use `rawPrisma.$transaction([...])` for batch operations, or use sequential awaits inside `runWithOrgContext`.

**DB migrations vs push** — This project currently uses `db push` (no `_prisma_migrations` table on remote). Use the Supabase MCP or `npm run db:push:remote` for schema changes. Do not run `migrate deploy` unless you've committed to that workflow.

**Supabase project** — Active project is `yvpbnzeycowtvuxiidbj` (lionheart Operations App). There is an old, unused project `zjiekwgindszxzmkawxc` (Lionheart_database) — do not run migrations against it.

---

## Smoke Tests

```bash
npm run smoke:all          # Full suite
npm run smoke:campus       # Campus auth + CRUD only
npm run smoke:set-password # Password setup flow
```

Tests hit the live API (configured by base URL in each script). Run after significant changes.
