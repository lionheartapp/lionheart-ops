/**
 * GET /api/messaging/gifs?q=cats&limit=24
 *
 * Proxy for GIPHY API — keeps the API key server-side.
 * Returns trending GIFs when no query, search results when q is provided.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || process.env.GIPHY_API_KEY || ''
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs'

export async function GET(req: NextRequest) {
  if (!GIPHY_API_KEY) {
    return NextResponse.json(fail('CONFIG_ERROR', 'GIPHY API key not configured'), { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 24, 50)

  const endpoint = query
    ? `${GIPHY_BASE}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`
    : `${GIPHY_BASE}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`

  try {
    const res = await fetch(endpoint)
    if (!res.ok) {
      return NextResponse.json(fail('GIPHY_ERROR', 'Failed to fetch GIFs'), { status: 502 })
    }

    const json = await res.json()

    // Return a simplified response
    const gifs = (json.data ?? []).map((g: Record<string, unknown>) => {
      const images = g.images as Record<string, Record<string, string>>
      return {
        id: g.id,
        title: g.title,
        preview: images.fixed_height?.url,
        original: images.original?.url,
        width: Number(images.original?.width) || 0,
        height: Number(images.original?.height) || 0,
      }
    })

    return NextResponse.json(ok(gifs))
  } catch {
    return NextResponse.json(fail('GIPHY_ERROR', 'Failed to fetch GIFs'), { status: 502 })
  }
}
