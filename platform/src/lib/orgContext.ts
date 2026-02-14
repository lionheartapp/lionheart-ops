import { AsyncLocalStorage } from 'async_hooks'
import type { Request } from 'next/server'
import { verifyToken } from './auth'

/**
 * Request-scoped organization ID for multi-tenant queries.
 * Set via runWithOrg(orgId, () => { ... }) so Prisma extension can filter by tenant.
 */
export const orgStorage = new AsyncLocalStorage<string>()

export function getOrgId(): string | undefined {
  return orgStorage.getStore()
}

/**
 * Extract org ID from request: Bearer token (preferred) or x-org-id header.
 */
export async function getOrgIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    return payload?.orgId ?? null
  }
  return req.headers.get('x-org-id')?.trim() || null
}

type PrismaOrgValidator = { organization: { findUnique: (args: { where: { id: string } }) => Promise<unknown> } }

/**
 * Run a callback with the given org ID in context.
 * Validates that the org exists before running.
 */
export async function runWithOrg<T>(
  orgId: string | null | undefined,
  prisma: PrismaOrgValidator,
  fn: () => Promise<T>
): Promise<T> {
  if (!orgId?.trim()) {
    throw new Error('Organization ID is required')
  }
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) {
    throw new Error('Invalid organization')
  }
  return orgStorage.run(orgId, fn)
}

/**
 * Wrapper for API route handlers: extracts org from Bearer token or x-org-id, validates, runs in tenant context.
 * Use: return withOrg(req, async () => { ... use prisma ... })
 */
export async function withOrg<T>(
  req: Request,
  prisma: PrismaOrgValidator,
  handler: () => Promise<T>
): Promise<T> {
  const orgId = await getOrgIdFromRequest(req)
  return runWithOrg(orgId, prisma, handler)
}
