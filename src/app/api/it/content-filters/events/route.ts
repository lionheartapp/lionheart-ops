import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getFilterEvents } from '@/lib/services/itContentFilterService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_CIPA_AUDIT_VIEW)

    const url = new URL(req.url)
    const platform = url.searchParams.get('platform') || undefined
    const eventType = url.searchParams.get('eventType') || undefined
    const disposition = url.searchParams.get('disposition') || undefined
    const isAdminOnly = url.searchParams.get('isAdminOnly') === 'true' ? true : undefined
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined

    return await runWithOrgContext(orgId, async () => {
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch filter events:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
