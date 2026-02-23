# Lionheart Platform

Multi-tenant school operations platform built on Next.js + Prisma.

## Architecture Conventions

The codebase follows this app-level structure:

- `src/app` - Routes and API handlers
- `src/components` - Reusable UI components
- `src/lib/services` - Business logic and domain services
- `src/lib/db` - Prisma client and org-scoped DB access
- `src/lib/auth` - Auth token signing/verification and permission-related auth utilities
- `prisma` - Prisma schema
- `types` - Shared TypeScript types

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for import boundaries and layering rules.
See [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) for Vercel deployment requirements.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3004](http://127.0.0.1:3004).

## Email setup (welcome/invite links)

Set these optional environment variables to enable automatic welcome emails:

- `APP_URL` (example: `http://127.0.0.1:3004`)
- `MAIL_FROM` (example: `no-reply@lionheartapp.com`)

Provider A (Resend):
- `RESEND_API_KEY`

Provider B (SMTP):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE` (`true` for TLS, commonly with port 465)

The app tries Resend first, then SMTP. If neither is configured, the API still returns a setup link that can be copied manually.

## Build

```bash
npm run build
npm run start
```

## Stack

- Next.js 15 + React 18
- Prisma ORM
- Tailwind CSS
- TanStack Query
