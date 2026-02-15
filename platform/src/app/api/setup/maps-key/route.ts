import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/setup/maps-key - Returns the Google Maps API key for the setup page.
 * Uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or falls back to GOOGLE_PLACES_API_KEY
 * (both work if Maps JavaScript API + Places API are enabled).
 */
export async function GET() {
  const key =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ error: 'Maps API not configured' }, { status: 503, headers: corsHeaders })
  }
  return NextResponse.json({ key }, { headers: corsHeaders })
}
