import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getFilterEvents } from '@/lib/services/itContentFilterService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const platform = searchParams.get('platform') || undefined
  const eventType = searchParams.get('eventType') || undefined
  const disposition = searchParams.get('disposition') || undefined
  const isAdminOnly = searchParams.get('isAdminOnly') === 'true' ? true : undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined

  const data = await getFilterEvents(orgId, {
    platform,
    eventType,
    disposition,
    isAdminOnly,
    from,
    to,
    limit,
    offset,
  })
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_CIPA_AUDIT_VIEW })
