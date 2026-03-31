import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listProvisioningEvents } from '@/lib/services/itProvisioningService'

export const GET = withAuth(async ({ searchParams }) => {
  const filters = {
    eventType: searchParams.get('eventType') || undefined,
    status: searchParams.get('status') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await listProvisioningEvents(filters)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_PROVISIONING_VIEW })
