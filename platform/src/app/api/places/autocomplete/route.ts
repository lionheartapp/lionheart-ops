import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:autocomplete'

/**
 * POST /api/places/autocomplete - Proxy to Google Places Autocomplete (New) API.
 * Keeps the API key server-side.
 * Body: { input: string }
 * Returns: { suggestions: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: 'Places API not configured' },
        { status: 503, headers: corsHeaders }
      )
    }

    const body = (await req.json()) as { input?: string }
    const input = typeof body.input === 'string' ? body.input.trim() : ''
    if (!input) {
      return NextResponse.json({ suggestions: [] }, { headers: corsHeaders })
    }

    // Bias to US for school addresses; can be made configurable later
    const payload = {
      input,
      languageCode: 'en',
      includedRegionCodes: ['us'],
    }

    const res = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Places API error:', res.status, errText)
      return NextResponse.json(
        { error: 'Address search failed' },
        { status: res.status >= 500 ? 502 : 400, headers: corsHeaders }
      )
    }

    const data = (await res.json()) as { suggestions?: Array<{ placePrediction?: unknown }> }
    return NextResponse.json(data, { headers: corsHeaders })
  } catch (err) {
    console.error('places/autocomplete error:', err)
    return NextResponse.json(
      { error: 'Address search failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
