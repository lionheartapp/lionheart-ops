# Lionheart Platform — CLAUDE.md

Educational institution management SaaS. Multi-tenant Next.js 15 app with one Supabase/PostgreSQL database shared across all organizations, isolated by `organizationId`.

---

## How to talk to Michael

Michael (the project owner) has dyslexia. Walls of text and densely-formatted output are genuinely hard to read. **Talk like a normal person**, not like a report.

- Short sentences. Short paragraphs.
- Plain English over jargon. If a technical term is needed, say it once and define it in passing.
- Skip nested bullet lists when a sentence will do.
- Avoid bold-everywhere and headline-stacking — use formatting only when it actually helps.
- When showing what was done, lead with the outcome in one line: "Fixed the login bug" — then offer detail only if useful.
- Status updates: 2–4 sentences, not 2–4 paragraphs.
- It is fine to say "I'm done" or "this didn't work" without ceremony.

This is a comprehension preference, not a capability one — Michael understands the technical detail, the format just gets in the way. When detail is genuinely needed (a long report, a code review summary), put it in a file rather than dumping it into chat.

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

### Required
```
DATABASE_URL                     # Pooled Supabase connection (transactions/queries)
DIRECT_URL                       # Direct Supabase connection (migrations/introspection)
AUTH_SECRET                      # JWT signing secret — must be long and random
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (storage, auth)
SUPABASE_SERVICE_ROLE_KEY        # Supabase service role key (server-side storage operations)
NEXT_PUBLIC_APP_URL              # Canonical app URL (used in OAuth callbacks, emails, QR codes)
NEXT_PUBLIC_PLATFORM_URL         # Platform base URL (used in email links, share links, asset labels)
```

### Optional — AI
```
GEMINI_API_KEY                   # Powers all AI features (events, maintenance, diagnostics, reports)
NEXT_PUBLIC_GEMINI_API_KEY       # Client-side fallback for Gemini (same key, exposed to browser)
```

### Optional — Email (Resend or SMTP)
```
RESEND_API_KEY                   # Resend API key — enables transactional emails
MAIL_FROM                        # Sender address (default: no-reply@lionheartapp.com)
CONTACT_EMAIL                    # Contact/reply-to address for outbound emails
SMTP_HOST                        # SMTP host (alternative to Resend)
SMTP_PORT                        # SMTP port
SMTP_USER                        # SMTP username
SMTP_PASS                        # SMTP password
SMTP_SECURE                      # "true" for TLS
```

### Optional — Payments
```
STRIPE_SECRET_KEY                # Stripe server-side key (billing, registration payments)
STRIPE_WEBHOOK_SECRET            # Stripe webhook signature verification
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # Stripe client-side key (payment forms)
```

### Optional — OAuth & Integrations
```
GOOGLE_CLIENT_ID                 # Google OAuth (calendar integration)
GOOGLE_CLIENT_SECRET             # Google OAuth secret
GOOGLE_PLACES_API_KEY            # Google Places API (school lookup, address autocomplete)
GOOGLE_MAPS_API_KEY              # Google Maps API (geocoding, address validation)
NEXTAUTH_SECRET                  # NextAuth secret (used by auth-config)
NEXTAUTH_URL                     # NextAuth callback base URL
PCO_APP_ID                       # Planning Center Online app ID
PCO_SECRET                       # Planning Center Online secret
AZURE_AD_CLIENT_ID               # Azure AD OAuth (SSO)
AZURE_AD_CLIENT_SECRET           # Azure AD OAuth secret
AZURE_AD_TENANT_ID               # Azure AD tenant
```

### Optional — Security & Monitoring
```
CRON_SECRET                      # Shared secret for cron job endpoints (Vercel Cron)
TURNSTILE_SECRET_KEY             # Cloudflare Turnstile server-side key (bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY   # Cloudflare Turnstile client-side key
CLASSLINK_WEBHOOK_SECRET         # ClassLink roster webhook verification
CLEVER_WEBHOOK_SECRET            # Clever roster webhook verification
SENTRY_DSN                       # Sentry error tracking DSN
NEXT_PUBLIC_SENTRY_DSN           # Sentry client-side DSN
SENTRY_AUTH_TOKEN                # Sentry release/sourcemap upload token
PLATFORM_AUTH_SECRET             # Platform-level auth (multi-org admin)
BRANDFETCH_API_KEY               # Brandfetch API (school logo lookup)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anonymous key (client-side browser access)
```

`.env` = remote/production. `.env.local` = local dev (takes precedence for db:* scripts).

Generate a secret: `npm run auth:secret`

---

## Database Commands

```bash
npm run db:push          # Push schema to local DB (no migration file)
npm run db:migrate       # Create + apply migration locally
npm run db:migrate:remote # Apply pending migrations to production
npm run db:studio        # Open Prisma Studio (local)
npm run db:seed          # Seed demo data (local)
npm run db:seed:remote   # Seed demo data (remote)
```

**Always run these from the project root, not `~`.**

### Schema Change Workflow (mandatory since May 2026 baseline)

Production now has a `_prisma_migrations` table. **Never use `db:push:remote` again.** The workflow is:

1. **Local dev:** use `db:push` for quick iteration (no migration file, fine for local)
2. **Ready to commit:** run `npm run db:migrate` — this creates a migration file in `prisma/migrations/`
3. **Commit** the migration file with your code changes
4. **Production deploy:** run `npm run db:migrate:remote` — this applies only new migrations, with rollback capability

`db:push:remote` is removed from the workflow because it bypasses the migration table and makes rollback impossible.

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
`User, Ticket, Event, DraftEvent, InventoryItem, TeacherSchedule, District, Site, Building, Space, Room, UserRoomAssignment, Campus, School`

**Soft-delete models** (`.delete()` → stamps `deletedAt`, reads auto-filter `deletedAt: null`):
`User, Ticket, Event, DraftEvent, InventoryItem, District, Site, Building, Space, Room, School, Campus`

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

## Content & Language Guidelines

### No Religious References in UI
This is a **secular, multi-tenant platform** for all types of educational institutions. Never use religious language, examples, or placeholder text anywhere in the application — including input placeholders, sample data, seed scripts, empty states, and documentation. Use neutral, universally applicable examples instead.

**Bad:** `"e.g. Morning Worship, Chapel, Devotion"` · `"Sync worship teams"`
**Good:** `"e.g. Morning Assembly, Staff Meeting, Awards Ceremony"` · `"Sync teams and schedules"`

This applies even when a specific tenant (like a Christian school) is the current customer — the platform itself must remain neutral.

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

**DB migrations vs push** — Production uses `prisma migrate deploy` (the `_prisma_migrations` table was baselined in May 2026). **Never use `db:push:remote`** — it bypasses migration history and breaks rollback. Use `db:push` locally for quick iteration, then `db:migrate` to create the migration file before committing. See the "Schema Change Workflow" section above.

**Supabase project** — Active project is `yvpbnzeycowtvuxiidbj` (lionheart Operations App). There is an old, unused project `zjiekwgindszxzmkawxc` (Lionheart_database) — do not run migrations against it.

---

## Smoke Tests

```bash
npm run smoke:all          # Full suite
npm run smoke:campus       # Campus auth + CRUD only
npm run smoke:set-password # Password setup flow
```

Tests hit the live API (configured by base URL in each script). Run after significant changes.

---

## Design & UI Standards (Always Apply)

When creating or editing ANY UI — components, pages, layouts, modals, drawers — always:

1. **Use 21st-dev-magic MCP tools** for animations, transitions, and polished component patterns
2. **Apply ui-ux-pro-max skill** for layout, accessibility, color contrast, interaction patterns, and the Pre-Delivery Checklist
3. **Apply frontend-design skill** for distinctive, production-grade interfaces that avoid generic AI aesthetics
4. **Check memory files** before starting — reuse patterns, color decisions, and component conventions from previous work

### UI Rules (non-negotiable)
- No empty states that require user action to see data — always show a useful default (e.g., "All Teams" shows all data, not "Select a team")
- Skeleton loading (`animate-pulse`) during data fetches, matching the final layout shape
- Card style: `bg-white border border-gray-200 rounded-xl p-6`
- Gradient accent cards: `bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200`
- All clickable elements get `cursor-pointer`
- Transitions: `transition-colors duration-200` on interactive elements
- Win/loss/tie badges: green-100/700, red-100/700, yellow-100/700
- Sport color dots: `w-2.5 h-2.5 rounded-full` with inline `backgroundColor`
- Campus filtering: always filter client-side by `activeCampusId` when in multi-campus views

### Form Fields — single source of truth (non-negotiable)

**Never write raw `<input>`, `<select>`, or `<textarea>` in product code.** Drift between fields (one with `rounded-lg` and `border-slate-200`, another with `rounded-xl` and `border-slate-300`) is exactly what this rule prevents. ESLint enforces this — `no-restricted-syntax` flags any raw form element outside `src/components/ui/`.

Always use the primitives in `src/components/ui/`:

- `<Input>` — single-line text inputs (text, date, time, email, password, etc.)
- `<Textarea>` — multi-line text
- `<Select>` — dropdowns with single-value options
- `<Checkbox>` — boolean toggles, optionally with label/description
- `<Radio>` + `<RadioGroup>` — mutually exclusive options
- `<SearchInput>` — search box with built-in magnifying glass + optional clear button
- `<FileInput>` — drag-and-drop + click-to-upload zone (handles selection only — parent decides what to do with the files)
- `<AssigneePicker>` — person picker with avatars (specialized Select for users, lives in `src/components/events/`)

All of these compose `src/components/ui/form-tokens.ts`, which in turn references theme tokens defined in `tailwind.config.ts`. **If you need a new field variant, build it on top of those tokens — do not fork the styles inline.** If a token is wrong, change the value in the right place and everything updates.

**Where each token lives:**
- **Numbers (radius, height)** → `tailwind.config.ts` under `theme.extend.borderRadius` and `theme.extend.height`
  - `borderRadius.field` (8px) — change here to retune all field corners app-wide
  - `borderRadius.field-panel` (12px) — dropdown panels
  - `height.field` (52px) — single-line fields
  - `height.field-sm` (36px) — compact / tabular fields
- **Class strings (border, focus, padding)** → `src/components/ui/form-tokens.ts`
  - `FIELD_BORDER` = `border border-slate-200` (resting)
  - `FIELD_BORDER_HOVER` = `hover:border-slate-300`
  - `FIELD_FOCUS` = focus state (indigo-400 border + indigo-100 ring)
  - `FIELD_BG` = `bg-white`
- **Composed presets** → also in `form-tokens.ts`
  - `INPUT_CLASSES`, `INPUT_CLASSES_SM`, `TEXTAREA_CLASSES`, `FIELD_TRIGGER_CLASSES`, `PANEL_CLASSES`

**Compact variant.** All single-line primitives accept `size="sm"` for dense / tabular contexts (table cells, inline editing rows). `size="default"` (52px) is for forms; `size="sm"` (36px) is for tables.

**To change the field corner radius app-wide:** edit `borderRadius.field` in `tailwind.config.ts` from `'0.5rem'` to whatever you want. Every Input, Select, Textarea, AssigneePicker, SearchInput, FileInput, and the panels they open will rebuild with the new radius. Same for height — edit `height.field`.

**ESLint enforcement.** `npx eslint <file>` will warn on every raw `<input>`, `<select>`, or `<textarea>`. The rule is set to `warn` (not `error`) until the existing ~640 violations are migrated. New code: prefer using the primitives directly. When touching an old file with violations, opportunistically convert them. For genuine exceptions, use `// eslint-disable-next-line no-restricted-syntax` with a one-line reason.

**Migration plan.** As old files are touched for unrelated work, convert the form elements while you're there. Once the warning count is at or near zero, flip the rule from `warn` to `error` in `.eslintrc.json` to lock the codebase down.

### Marketing Skills (Available on Demand)

34 marketing skills are installed in `.claude/skills/`. Use them when working on any marketing-related task:

- **Conversion optimization**: `page-cro`, `signup-flow-cro`, `form-cro`, `onboarding-cro`, `popup-cro`, `paywall-upgrade-cro`, `churn-prevention`
- **Copy & content**: `copywriting`, `copy-editing`, `content-strategy`, `cold-email`, `email-sequence`, `social-content`
- **SEO & discovery**: `seo-audit`, `ai-seo`, `programmatic-seo`, `schema-markup`, `site-architecture`
- **Paid & growth**: `paid-ads`, `ad-creative`, `ab-test-setup`, `analytics-tracking`, `referral-program`, `free-tool-strategy`
- **Strategy & sales**: `launch-strategy`, `pricing-strategy`, `marketing-ideas`, `marketing-psychology`, `competitor-alternatives`, `sales-enablement`, `revops`
- **Foundation**: `product-marketing-context` — set up once, referenced by all other skills

When building public-facing pages (landing pages, pricing, onboarding flows), automatically apply relevant CRO and copywriting skills alongside the UI skills.

### Continuous Learning
After completing any significant work, update the memory files at `~/.claude/projects/-Users-mkerley-Desktop-Linfield-Test/memory/` with:
- New patterns established (component structure, data flow, styling decisions)
- UX lessons learned (what worked, what was a bad pattern)
- Reusable code patterns for future reference
- Marketing decisions and copy patterns that performed well
