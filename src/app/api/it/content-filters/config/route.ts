import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getFilterConfigs } from '@/lib/services/itContentFilterService'

export const GET = withAuth(async ({ orgId }) => {
  const configs = await getFilterConfigs(orgId)
  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.IT_FILTERS_CONFIGURE })
