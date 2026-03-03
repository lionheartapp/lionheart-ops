import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as notificationService from '@/lib/services/notificationService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50)
    const cursor = url.searchParams.get('cursor') || undefined

    return await runWithOrgContext(orgId, async () => {
      const result = await notificationService.getUserNotifications(ctx.userId, { limit, cursor })
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
