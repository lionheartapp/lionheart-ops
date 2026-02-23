# Architecture & Import Boundaries

This document defines the enforced application structure and import rules for maintainability.

## Directory Ownership

- `src/app`:
  - Next.js routes and API handlers.
  - Should orchestrate requests/responses, not hold domain-heavy business logic.
- `src/components`:
  - Reusable UI components.
  - Keep components presentational when possible; delegate business logic to `src/lib/services`.
- `src/lib/services`:
  - Domain/business logic (AI, operations, workflow orchestration).
  - Preferred location for reusable logic used by API routes and server actions.
- `src/lib/db`:
  - Prisma client and org-scoped database access setup.
  - Avoid duplicating Prisma client creation elsewhere.
- `src/lib/auth`:
  - Token signing/verification and auth-related helper logic.
- `prisma`:
  - Prisma schema and DB model source of truth.
- `types`:
  - Shared TypeScript types used across app/lib/components.

## Import Rules

- Use path alias imports from root alias:
  - `@/lib/services/...`
  - `@/lib/db`
  - `@/lib/auth`
- Do not reintroduce legacy import roots like `@/services/...`.
- Keep API handlers in `src/app/api/*` thin:
  - Validate input
  - Call service layer (`src/lib/services`)
  - Return normalized API response

## Layering Guidelines

- UI (`src/components`) should not import Prisma directly.
- Services (`src/lib/services`) may import DB/auth modules from `src/lib/db` and `src/lib/auth`.
- API routes should prefer calling services instead of embedding domain decisions inline.

## Multi-tenant Safety Notes

- Tenant context should be established per request before DB operations.
- Do not bypass org-scoped DB access patterns in `src/lib/db`.
- Avoid route-level fallback mock data for auth/tenant failures; return explicit 401/4xx.

## Quick Review Checklist

- Is new business logic in `src/lib/services`?
- Are auth and db imports coming from `@/lib/auth` and `@/lib/db`?
- Did any `@/services/...` imports reappear?
- Does the route stay orchestration-focused instead of domain-heavy?
