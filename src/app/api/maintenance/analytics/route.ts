/**
 * GET /api/maintenance/analytics
 *
 * Returns all 8 analytics payloads in a single response.
 * Accepts optional query params:
 *   - campusId: filter by campus
 *   - schoolId: filter by school
 *   - months: lookback window (default 6)
 *
 * Requires: MAINTENANCE_VIEW_ANALYTICS permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getAllAnalytics } from '@/lib/services/maintenanceAnalyticsService'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

// Analytics data TTL: 2 minutes (heavy queries, data doesn't need real-time freshness)
const ANALYTICS_CACHE_TTL = 2 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS)

    const url = new URL(req.url)
    const campusId = url.searchParams.get('campusId') || undefined
    const schoolId = url.searchParams.get('schoolId') || undefined
    const months = parseInt(url.searchParams.get('months') || '6', 10)

    const effectiveMonths = isNaN(months) ? 6 : months
    const cacheKey = settingsCacheKey(orgId, `maint-analytics:${campusId || ''}:${schoolId || ''}:${effectiveMonths}`)
    const data = await runWithOrgContext(orgId, () =>
      getCached(cacheKey, () =>
        getAllAnalytics(orgId, { campusId, schoolId, months: effectiveMonths }),
        ANALYTICS_CACHE_TTL
      )
    )

    return NextResponse.json(ok(data), {
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/analytics]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
