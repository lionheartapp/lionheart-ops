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
