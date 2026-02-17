import { AsyncLocalStorage } from 'async_hooks'
import type { NextRequest } from 'next/server'
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
export async function getOrgIdFromRequest(req: NextRequest): Promise<string | null> {
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
  req: NextRequest,
  prisma: PrismaOrgValidator,
  handler: () => Promise<T>
): Promise<T> {
  const orgId = await getOrgIdFromRequest(req)
  return runWithOrg(orgId, prisma, handler)
}

/**
 * Check if a module is enabled for the current org (must be inside withOrg).
 * Throws MODULE_NOT_ACTIVE if not enabled.
 */
export async function requireModule(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  orgId: string | undefined,
  moduleName: 'waterManagement' | 'visualCampus' | 'advancedInventory'
): Promise<void> {
  if (!orgId?.trim()) {
    throw new Error('Organization ID is required')
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })
  if (!org) {
    throw new Error('Invalid organization')
  }
  const modules = (org.settings && typeof org.settings === 'object' && (org.settings as Record<string, unknown>).modules) as Record<string, unknown> | undefined
  const moduleVal = modules?.[moduleName]
  const enabled = moduleVal === true || (moduleVal && typeof moduleVal === 'object' && (moduleVal as Record<string, unknown>).enabled === true)
  if (!enabled) {
    throw new Error('MODULE_NOT_ACTIVE')
  }
}
