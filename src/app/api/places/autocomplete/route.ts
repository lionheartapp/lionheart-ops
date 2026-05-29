import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { logger } from '@/lib/logger'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

/**
 * @authOnly Proxies address suggestions only for signed-in users.
 *
 * GET /api/places/autocomplete?input=...
 *
 * Proxies Google Places Autocomplete API.
 * Returns suggestions with separate venue name (mainText) and address (secondaryText).
 */
export async function GET(req: NextRequest) {
  try {
    await getUserContext(req)

    const input = req.nextUrl.searchParams.get('input')
    if (!input || input.length < 3) {
      return NextResponse.json(ok([]))
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(fail('CONFIG_ERROR', 'Google Places API key not configured'), { status: 500 })
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', input)
    url.searchParams.set('types', 'establishment|geocode')
    url.searchParams.set('components', 'country:us')
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error({ status: data.status, errorMessage: data.error_message }, 'Google API error')
      return NextResponse.json(fail('EXTERNAL_ERROR', 'Address lookup failed'), { status: 502 })
    }

    const suggestions = (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      // structured_formatting gives us venue name vs address separately
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }))

    return NextResponse.json(ok(suggestions))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    logger.error({ error: String(error) }, 'Places autocomplete error')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
