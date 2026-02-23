# Deployment Checklist (Vercel)

## 1) Project Settings

- Framework: Next.js
- Root Directory: repository root
- Build command: `npm run build`
- Install command: `npm ci`
- Function runtime budgets are defined in [vercel.json](../vercel.json) with route-specific `maxDuration` values.

## 2) Required Environment Variables

Set these in Vercel (Production + Preview as appropriate):

- `DATABASE_URL` (required)
- `DIRECT_URL` (required)
- `AUTH_SECRET` (required)

Generate a strong `AUTH_SECRET` locally with:

- `npm run auth:secret`

Optional:

- `GEMINI_API_KEY` (only needed for AI semantic patching)

Reference values are documented in [.env.example](../.env.example).

## 3) DB Readiness

Before first production release:

- Validate Prisma schema compiles locally: `npm run db:generate`
- Ensure production database exists and credentials are valid.
- Run migrations from trusted pipeline/workstation (`npm run db:migrate`) before traffic cutover.

## 4) Build Validation

- Local preflight: `npm run build`
- Env preflight: `npm run check:env`
- Deploy-safe build command: `npm run build:deploy`
- CI should pass architecture checks and build before merge.

## 5) Post-Deploy Smoke Checks

- `GET /login` loads
- `POST /api/auth/login` responds as expected
- `GET /app` loads for authenticated flow
- `GET /api/events` and `GET /api/draft-events` respond (with auth + tenant context)

## 6) Runtime Budget Guidance

- Keep auth and simple CRUD endpoints on shorter durations.
- Assign longer duration only to routes that orchestrate additional workflows.
- Prefer raising route-specific values over raising global wildcard defaults.
