# Tenant Isolation & Security Verification

## How it works

1. **x-org-id header**: Every API request (except `/api/auth/signup` and `/api/cron/*`) must include an `x-org-id` header with a valid Organization ID.

2. **Middleware validation**: The Platform middleware validates the header exists and has a reasonable format before the request reaches route handlers.

3. **runWithOrg**: Each API route that accesses tenant-scoped data calls `withOrg(req, prismaBase, handler)`, which:
   - Reads `x-org-id` from the request
   - Validates the org exists in the Organization table
   - Runs the handler inside `AsyncLocalStorage.run(orgId, ...)` so the Prisma extension has context

4. **Prisma extension**: The tenant-scoped Prisma client automatically:
   - Injects `organizationId: orgId` into `where` for all `findMany`, `findFirst`, `findUnique`, `update`, `delete`
   - Injects `organizationId: orgId` into `data` for all `create` and `createMany`

5. **Isolation**: Each tenant has a unique Organization ID. When Tenant A sends `x-org-id: <org-a>`:
   - All reads filter by `organizationId = <org-a>` → only Tenant A's data
   - All creates set `organizationId = <org-a>` → new data belongs to Tenant A only
   - Tenant A cannot see or modify Tenant B's data (or any other tenant's).

## Verification

To verify isolation:

1. **Sign up two tenants** via `/signup` (e.g. "School A", "School B")
2. **Add buildings/rooms** for each on the Setup page
3. **Query as Tenant A**: Use `x-org-id: <org-a-id>` → only School A's data
4. **Query as Tenant B**: Use `x-org-id: <org-b-id>` → only School B's data, never School A's

The Prisma extension ensures no tenant can ever read or write another tenant's data when the correct `x-org-id` is sent.
