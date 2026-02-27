/**
 * Weather API
 *
 * GET /api/weather — Returns current weather for the org's location.
 * Optionally accepts ?lat=...&lng=... query params, otherwise uses org coordinates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { fetchWeather } from '@/lib/services/weatherService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req) // verify auth

    const { searchParams } = new URL(req.url)
    let lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    let lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null

    // Fall back to org coordinates if not provided
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      // Use raw query for new lat/lng fields until Prisma client is regenerated
      const rows = await rawPrisma.$queryRaw<Array<{
        latitude: number | null
        longitude: number | null
      }>>`
        SELECT latitude, longitude
        FROM "Organization"
        WHERE id = ${orgId}
        LIMIT 1
      `

      const org = rows[0]
      if (!org?.latitude || !org?.longitude) {
        return NextResponse.json(
          fail('NO_LOCATION', 'No location data available. Add a school address to see weather.'),
          { status: 404 }
        )
      }

      lat = org.latitude
      lng = org.longitude
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
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    console.error('Weather API error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch weather'), { status: 500 })
  }
}
