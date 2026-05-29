import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

/**
 * Check if messaging is enabled for the given organization.
 * Returns a 403 response if disabled, or null if allowed.
 *
 * Checks two sources (either is sufficient):
 * 1. Organization.messagingEnabled boolean (legacy / direct DB flag)
 * 2. TenantModule row with moduleId='messaging' (Add-ons tab toggle)
 *
 * Usage in a route handler:
 *   const blocked = await assertMessagingEnabled(orgId)
 *   if (blocked) return blocked
 */
export async function assertMessagingEnabled(orgId: string): Promise<NextResponse | null> {
  if (await isMessagingEnabled(orgId)) return null

  return NextResponse.json(
    fail('FEATURE_DISABLED', 'Messaging is not enabled for this organization'),
    { status: 403 }
  )
}

export async function isMessagingEnabled(orgId: string): Promise<boolean> {
  // Check org-level boolean first (fast path)
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { messagingEnabled: true },
  })
  if (org?.messagingEnabled) return true

  // Fallback: check TenantModule (Add-ons toggle)
  const tenantModule = await rawPrisma.tenantModule.findFirst({
    where: { organizationId: orgId, moduleId: 'messaging' },
    select: { id: true },
  })
  return Boolean(tenantModule)
}
