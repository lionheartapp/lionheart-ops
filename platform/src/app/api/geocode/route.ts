import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'
import { geocodeAddress } from '@/lib/geocode'

/**
 * GET /api/geocode?address=... - Geocode address to lat/long using OpenStreetMap Nominatim.
 * No API key required. Used for weather-based water management alerts.
 */
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address')?.trim()
    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await geocodeAddress(address)
    if (!result) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { latitude: result.latitude, longitude: result.longitude },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('Geocode error:', err)
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
