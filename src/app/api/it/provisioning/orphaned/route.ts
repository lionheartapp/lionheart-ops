import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrphanedAccounts } from '@/lib/services/itProvisioningService'

export const GET = withAuth(async ({ searchParams }) => {
  const resolved = searchParams.get('resolved')

  const accounts = await getOrphanedAccounts({
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
  })
  return NextResponse.json(ok(accounts))
}, { permission: PERMISSIONS.IT_PROVISIONING_VIEW })
