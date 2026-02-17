import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/places/details?placeId=xxx - Fetch Place Details from Google to verify school name & types.
 * Returns displayName, formattedAddress, types for cross-checking address vs school.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Places API not configured' }, { status: 503, headers: corsHeaders })
    }

    const placeId = req.nextUrl.searchParams.get('placeId')?.trim()
    if (!placeId) {
      return NextResponse.json({ error: 'Missing placeId' }, { status: 400, headers: corsHeaders })
    }

    // Place Details (New) - displayName, formattedAddress, types
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,types,websiteUri',
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Place Details API error:', res.status, errText)
      return NextResponse.json(
        { error: 'Could not verify place details' },
        { status: res.status >= 500 ? 502 : 400, headers: corsHeaders }
      )
    }

    const data = (await res.json()) as {
      id?: string
      displayName?: { text?: string }
      formattedAddress?: string
      types?: string[]
      websiteUri?: string
    }

    const isSchool = (data.types || []).some((t) =>
      ['school', 'university', 'secondary_school', 'primary_school', 'college'].includes(t)
    )

    return NextResponse.json(
      {
        name: data.displayName?.text || null,
        address: data.formattedAddress || null,
        types: data.types || [],
        isSchool,
        websiteUri: data.websiteUri || null,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('places/details error:', err)
    return NextResponse.json(
      { error: 'Could not verify place details' },
      { status: 500, headers: corsHeaders }
    )
  }
}
