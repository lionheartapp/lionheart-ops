import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { getAllITAnalytics } from '@/lib/services/itAnalyticsService'

// Simple in-memory cache
let cache: { key: string; data: unknown; ts: number } | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ANALYTICS_READ)

    const url = new URL(req.url)
    const schoolId = url.searchParams.get('schoolId') || undefined
    const months = parseInt(url.searchParams.get('months') || '6', 10)

    const cacheKey = `${orgId}:${schoolId ?? 'all'}:${months}`

    // Check cache
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(ok(cache.data))
    }

    return await runWithOrgContext(orgId, async () => {
      const data = await getAllITAnalytics(orgId, { schoolId, months })
      cache = { key: cacheKey, data, ts: Date.now() }
      return NextResponse.json(ok(data))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch IT analytics:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
