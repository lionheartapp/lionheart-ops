# SaaS Productization Roadmap

> Plan to turn the Linfield School Facility Management system into a sellable, multi-tenant SaaS product.

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| **Data** | Single-tenant | No Organization/Tenant model; all data implicitly for one school |
| **Auth** | None | Users from static `linfieldDirectory.js`; no login, no sessions |
| **Branding** | Hardcoded | `VITE_ORG_NAME` in .env; `linfield-inventory-prefs` in localStorage |
| **Apps** | 2 apps | Vite (Lionheart) + Next.js (Platform); separate ports, CORS needed |
| **Data sources** | Mixed | Platform: Prisma/DB. Lionheart: static files + React state (tickets, events, forms) |
| **Supabase** | Unused | Keys in .env; DB used but Auth not wired |

---

## Phase 1: Foundation (Multi-Tenancy + Auth)

**Goal:** Add an `Organization` (tenant) layer and real authentication so each school is isolated.

### 1.1 Schema: Organization Model

Add to `platform/prisma/schema.prisma`:

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique   // e.g. "linfield-christian"
  subdomain   String?  @unique   // e.g. "linfield" for linfield.yourapp.com
  logoUrl     String?
  website     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       OrganizationMember[]
  buildings   Building[]
  // ... other tenant-scoped models
}

model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  userId         String   // Supabase auth user id
  role           String   // admin, member, viewer
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(...)
}
```

Add `organizationId` to all tenant-scoped models: `Building`, `Room`, `User`, `Ticket`, `Event`, `Expense`, `Budget`, etc.

### 1.2 Auth: Supabase Auth

- Use Supabase Auth for login (email/password, magic links, optional OAuth)
- RLS (Row Level Security) or middleware: filter all queries by `organizationId`
- Session: JWT contains `org_id`; API validates on every request

### 1.3 Config Abstraction

Replace hardcoded org config with a tenant-aware config:

- **Today:** `VITE_ORG_NAME`, `VITE_ORG_WEBSITE` in .env
- **Target:** `Organization` record + optional `OrganizationSettings` (JSON for feature flags, AI context)

---

## Phase 2: Consolidate Apps

**Goal:** One deployment, simpler ops, no CORS.

### Option A (Recommended): Single Next.js App

- Move Lionheart UI into `platform/src/app` as Next.js pages
- Use Next.js API routes for all endpoints
- Single `npm run build` and deploy

### Option B: Keep Vite, Proxy APIs

- Vite app served from same domain (e.g. `/app/*`) via reverse proxy
- Platform APIs at `/api/*` on same origin
- Requires routing configuration (Vercel rewrites, etc.)

---

## Phase 3: Tenant Onboarding & Billing

### 3.1 Self-Service Signup

- Landing page → Sign up → Create `Organization` + first admin user
- Optional: invite team members by email
- Supabase Auth handles invites

### 3.2 Billing (Stripe)

- `Organization.plan` or `Subscription` table: `free`, `pro`, `enterprise`
- Stripe Customer per org; webhooks for subscription lifecycle
- Feature gating: e.g. campus map and AI only on `pro`+

---

## Phase 4: Product Polish

### 4.1 White-Label

- Custom domain: `facilities.linfieldchristian.org` → resolve to tenant
- Logo, colors, favicon from `Organization`
- Remove "Lionheart" branding or make it configurable

### 4.2 Feature Flags

Store per-org: `{ "campusMap": true, "aiForms": true, "receiptOcr": true, "monthlyReport": true }`

### 4.3 Data Migration

- Move `linfieldDirectory` users into DB (Supabase Auth + `User` table)
- Move `INITIAL_SUPPORT_REQUESTS`, `INITIAL_EVENTS`, etc. to Prisma (or keep as seed per org)

---

## Quick Wins (Done)

1. **Rename hardcoded keys**  
   `linfield-inventory-prefs` → `schoolops-inventory-prefs`

2. **Env-driven org config**  
   `orgContext.js` uses `VITE_ORG_*`; no Linfield fallbacks.

3. **Add `Organization` model**  
   Added to schema with `organizationId` on `Building` (optional for backward compat).

4. **Platform tenant helper**  
   `platform/src/lib/tenant.ts` for future org resolution.

---

## Suggested Order

1. Add `Organization` + `organizationId` to schema (foundation)
2. Consolidate to single Next.js app (simplify deployment)
3. Wire Supabase Auth (real login, org context)
4. Build tenant onboarding (signup flow)
5. Add Stripe billing
6. White-label and feature flags

---

## File Map: What to Change

| Current | SaaS-Ready |
|---------|------------|
| `src/data/linfieldDirectory.js` | DB `User` + `OrganizationMember`; seed or import |
| `src/data/teamsData.js` | Keep role logic; fetch users from API |
| `src/config/orgContext.js` | Fetch from `Organization` + settings API |
| `INVENTORY_PREFS_KEY` | `org-${orgId}-inventory-prefs` |
| `supportRequests` (React state) | Sync with Platform API; store in DB |
| `events` (React state) | Already has icalService; add Prisma `Event` sync |
| Platform APIs | Add `organizationId` filter to all queries |

---

## Naming for the Product

Consider a product name (e.g. "SchoolOps", "FacilityHub") and use it in:
- `package.json` name
- App title
- Login/branding

Keep "Lionheart" as optional sub-brand if desired.
