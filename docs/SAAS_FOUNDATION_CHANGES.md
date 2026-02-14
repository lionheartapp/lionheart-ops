# SaaS Foundation Changes

> Concrete steps to make the codebase product-ready.

---

## 1. Add Organization Model (Schema)

Add to `platform/prisma/schema.prisma`:

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logoUrl   String?
  website   String?
  settings  Json?    // Feature flags, AI context, etc.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  buildings Building[]
}

// Add to Building:
organizationId String?
organization   Organization? @relation(fields: [organizationId], references: [id])
```

**Strategy:** Add `organizationId` as optional first (nullable), then backfill with a single org. New tenants get org on signup.

---

## 2. Config Layer (Tenant Context)

Create `platform/src/lib/tenant.ts`:

```ts
// Resolves org config from: session/JWT (future) > env (current)
export function getOrgConfig() {
  return {
    name: process.env.ORG_NAME || process.env.VITE_ORG_NAME || 'School',
    website: process.env.ORG_WEBSITE || process.env.VITE_ORG_WEBSITE || '',
    slug: process.env.ORG_SLUG || 'default',
  }
}
```

Lionheart’s `orgContext.js` already uses `VITE_ORG_*` — keep that. For Platform APIs, use `getOrgConfig()` when org-specific data is needed.

---

## 3. Rename Hardcoded Keys

| File | Change |
|------|--------|
| `src/App.jsx` | Uses `schoolops-inventory-prefs` |
| `src/config/orgContext.js` | Generic fallback "your organization" |

---

## 4. Directory as Seed Data

- Keep `sampleDirectory.js` as **sample/demo data**
- Add `platform/prisma/seed.ts` that creates org + users from directory
- For other tenants, users come from signup/invite

---

## 5. Consolidation Plan (Single App)

When ready to merge:

1. Copy `src/*` into `platform/src/app/(dashboard)/*` or `platform/src/components/`
2. Replace `fetch(VITE_PLATFORM_URL + '/api/...')` with `fetch('/api/...')`
3. Remove Vite app or keep it only for local dev of dashboard
4. Single deployment: `platform` serves everything

---

## 6. Feature Flags (Future)

Store in `Organization.settings`:

```json
{
  "campusMap": true,
  "aiForms": true,
  "receiptOcr": true,
  "monthlyReport": true,
  "safetyMode": true
}
```

API checks before enabling expensive features.
