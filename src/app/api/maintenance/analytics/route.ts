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

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAllAnalytics } from '@/lib/services/maintenanceAnalyticsService'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

// Analytics data TTL: 2 minutes (heavy queries, data doesn't need real-time freshness)
const ANALYTICS_CACHE_TTL = 2 * 60 * 1000

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const campusId = searchParams.get('campusId') || undefined
  const schoolId = searchParams.get('schoolId') || undefined
  const months = parseInt(searchParams.get('months') || '6', 10)

  const effectiveMonths = isNaN(months) ? 6 : months
  const cacheKey = settingsCacheKey(orgId, `maint-analytics:${campusId || ''}:${schoolId || ''}:${effectiveMonths}`)
  const data = await getCached(cacheKey, () =>
    getAllAnalytics(orgId, { campusId, schoolId, months: effectiveMonths }),
    ANALYTICS_CACHE_TTL
  )

  return NextResponse.json(ok(data), {
    headers: {
      'Cache-Control': 'no-cache',
    },
  })
}, { permission: PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS })
