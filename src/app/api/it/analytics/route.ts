import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAllITAnalytics } from '@/lib/services/itAnalyticsService'

// Simple in-memory cache
let cache: { key: string; data: unknown; ts: number } | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const schoolId = searchParams.get('schoolId') || undefined
  const months = parseInt(searchParams.get('months') || '6', 10)

  const cacheKey = `${orgId}:${schoolId ?? 'all'}:${months}`

  // Check cache
  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(ok(cache.data))
  }

  const data = await getAllITAnalytics(orgId, { campusId: schoolId, months })
  cache = { key: cacheKey, data, ts: Date.now() }
  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.IT_ANALYTICS_READ })
