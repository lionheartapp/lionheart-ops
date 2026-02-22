import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

// Mock fallback when Places API is not configured
const MOCK_SCHOOLS = [
  {
    name: 'Lincoln Academy',
    address: '31950 Main St, Temecula, CA 92592',
    website: 'https://www.lincolnacademy.edu',
    logo: 'https://logo.clearbit.com/lincolnacademy.edu',
    domain: 'lincolnacademy.edu',
    placeId: 'mock-lincoln',
  },
  {
    name: 'Rancho Christian School',
    address: '31300 Rancho Community Way, Temecula, CA 92592',
    website: 'https://ranchochristian.org',
    logo: 'https://logo.clearbit.com/ranchochristian.org',
    domain: 'ranchochristian.org',
    placeId: 'mock-rancho',
  },
]

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * POST /api/setup/search-school - Search for a school by name.
 * Uses Google Places Text Search when API key is configured, otherwise mock data.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string }
    const query = String(body?.query || '').trim()
    if (!query) {
      return NextResponse.json({ found: false }, { status: 400, headers: corsHeaders })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim()

    if (!apiKey) {
      // Fallback to mock
      await new Promise((r) => setTimeout(r, 800))
      const lowerQ = query.toLowerCase()
      const match = MOCK_SCHOOLS.find((s) => s.name.toLowerCase().includes(lowerQ))
      if (match) {
        return NextResponse.json({ found: true, ...match }, { headers: corsHeaders })
      }
      return NextResponse.json({ found: false }, { headers: corsHeaders })
    }

    // Google Places Text Search (New)
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.types',
      },
      body: JSON.stringify({
        textQuery: `${query} school`,
        pageSize: 5,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Places searchText error:', res.status, errText)
      return NextResponse.json({ found: false }, { headers: corsHeaders })
    }

    const data = (await res.json()) as {
      places?: Array<{
        id?: string
        displayName?: { text?: string }
        formattedAddress?: string
        websiteUri?: string
        types?: string[]
      }>
    }

    const places = data.places || []
    const schoolTypes = ['school', 'university', 'secondary_school', 'primary_school', 'college', 'elementary_school']
    const place = places.find((p) =>
      (p.types || []).some((t) => schoolTypes.includes(t))
    ) || places[0]

    if (!place) {
      return NextResponse.json({ found: false }, { headers: corsHeaders })
    }

    const name = place.displayName?.text || ''
    const address = place.formattedAddress || ''
    const websiteUri = place.websiteUri || ''
    const domain = extractDomain(websiteUri)

    const logo = domain
      ? `https://logo.clearbit.com/${domain}`
      : ''

    return NextResponse.json(
      {
        found: true,
        name,
        address,
        website: websiteUri || undefined,
        domain: domain || undefined,
        logo: logo || undefined,
        placeId: place.id,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('search-school error:', err)
    return NextResponse.json({ found: false }, { status: 500, headers: corsHeaders })
  }
}
