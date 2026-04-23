/**
 * Weather API
 *
 * GET /api/weather — Returns current weather for the org's location.
 * Optionally accepts ?lat=...&lng=... query params, otherwise uses org coordinates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { fetchWeather } from '@/lib/services/weatherService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req) // verify auth

    const { searchParams } = new URL(req.url)
    let lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    let lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null

    // Fall back to the primary School's coordinates if not provided. In the
    // Phase 1c ontology inversion, `latitude`/`longitude` moved from Organization
    // to School (per-institution), so we pull them from the first-sorted,
    // non-deleted School record for the org.
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      const primarySchool = await rawPrisma.school.findFirst({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { latitude: true, longitude: true },
      })

      if (!primarySchool?.latitude || !primarySchool?.longitude) {
        return NextResponse.json(
          fail('NO_LOCATION', 'No location data available. Add a school address to see weather.'),
          { status: 404 }
        )
      }

      lat = primarySchool.latitude
      lng = primarySchool.longitude
    }

    const weather = await fetchWeather(lat, lng)

    if (!weather) {
      return NextResponse.json(
        fail('WEATHER_UNAVAILABLE', 'Weather data is temporarily unavailable'),
        { status: 503 }
      )
    }

    return NextResponse.json(ok(weather))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    logger.error({ error: String(error) }, 'Failed to fetch weather')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch weather'), { status: 500 })
  }
}
