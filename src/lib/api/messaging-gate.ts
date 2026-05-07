import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

/**
 * Check if messaging is enabled for the given organization.
 * Returns a 403 response if disabled, or null if allowed.
 *
 * Usage in a route handler:
 *   const blocked = await assertMessagingEnabled(orgId)
 *   if (blocked) return blocked
 */
export async function assertMessagingEnabled(orgId: string): Promise<NextResponse | null> {
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { messagingEnabled: true },
  })
  if (!org?.messagingEnabled) {
    return NextResponse.json(
      fail('FEATURE_DISABLED', 'Messaging is not enabled for this organization'),
      { status: 403 }
    )
  }
  return null
}
