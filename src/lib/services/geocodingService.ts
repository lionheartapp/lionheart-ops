/**
 * Geocoding Service
 *
 * Uses Google Geocoding API to convert addresses to coordinates.
 * Reuses the same API key as Gemini/Places (GEMINI_API_KEY).
 */

export interface GeocodingResult {
  lat: number
  lng: number
  formattedAddress: string
}

/**
 * Geocode a physical address to lat/lng coordinates.
 * Returns null on any failure (network, invalid address, etc.)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  )?.trim()

  if (!apiKey) {
    console.warn('[Geocoding] No API key found (GOOGLE_MAPS_API_KEY / GEMINI_API_KEY)')
    return null
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.warn(`[Geocoding] API returned ${res.status}`)
      return null
    }

    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn(`[Geocoding] No results for address: "${address}" (status: ${data.status})`)
      return null
    }

    const result = data.results[0]
    const { lat, lng } = result.geometry.location

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
    }
  } catch (error) {
    console.error('[Geocoding] Error:', error)
    return null
  }
}
