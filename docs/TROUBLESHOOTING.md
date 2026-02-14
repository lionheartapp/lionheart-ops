# Troubleshooting Guide

Quick fixes for common issues with Lionheart + Platform.

---

## 1. Check Environment Variables

Both apps need correct `.env` config to communicate.

**Lionheart (root):**

| Variable | Value |
|----------|-------|
| `VITE_PLATFORM_URL` | `http://localhost:3001` (no trailing slash) |
| `VITE_CURRENT_ORG_ID` | Org ID from signup flow |
| `VITE_ORG_NAME` | `your school` (generic fallback) |
| `VITE_GEMINI_API_KEY` | Gemini API key |

**Platform (`platform/`):**

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase pooled connection string |
| `DIRECT_URL` | Supabase direct connection string |
| `JWT_SECRET` | Secret for auth tokens |
| `NEXT_PUBLIC_PLATFORM_URL` | `http://localhost:3001` |
| `NEXT_PUBLIC_LIONHEART_URL` | `http://localhost:5173` |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | Default org for Platform UI |

---

## 2. Verify Port Configuration

Both dev servers must run at once:

- **Lionheart:** `npm run dev` in root → Port **5173**
- **Platform:** `cd platform && npm run dev` → Port **3001**

---

## 3. x-org-id and Bearer Token

The backend requires either:

- `x-org-id` header (org ID string), or
- `Authorization: Bearer <token>` (JWT from login)

**401 / "Missing x-org-id" errors:**

- **Lionheart:** `VITE_CURRENT_ORG_ID` is used by `platformApi.js` to add `x-org-id`.
- **Logged-in users:** Token is sent automatically; `x-org-id` is only needed for unauthenticated or fallback flows.

---

## 4. Database Sync (Prisma)

If you see 500 errors or schema mismatches:

```bash
cd platform
npx prisma generate
npx prisma db push
```

**Existing data (pre–multi-tenant):** See `docs/MULTI_TENANT_MIGRATION.md` for the backfill script.

---

## 5. Common Fixes

| Issue | Fix |
|-------|-----|
| **CORS** | Platform `cors.ts` allows `*` in dev. Add specific origins in production. |
| **Wrong Prisma client** | Use `prisma` (tenant-scoped) for org-scoped queries; use `prismaBase` only for auth/org lookup. |
| **Google OAuth** | Add redirect URI to Google Cloud Console: `http://localhost:3001/api/auth/google/callback` (or your deployed URL). |
| **Vercel build fails** | Clear build cache and redeploy. Check `platform/src/app/api/expenses/route.ts` if you see JSON/ocrData type errors. |

---

## 6. Deployment (Vercel)

- **Platform:** Root Directory = `platform`, env vars from `platform/.env`.
- **Lionheart:** Root Directory = `.`, set `VITE_PLATFORM_URL` to your deployed Platform URL.

See `docs/VERCEL_DEPLOYMENT.md` for full steps.
