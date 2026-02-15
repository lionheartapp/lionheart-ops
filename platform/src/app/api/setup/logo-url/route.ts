import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/setup/logo-url?domain=example.com - Returns Brandfetch logo URL for a domain.
 * Requires BRANDFETCH_CLIENT_ID in env (get one at https://developers.brandfetch.com/register).
 * Falls back to Clearbit if Brandfetch is not configured.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase()
  if (!domain || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400, headers: corsHeaders })
  }

  const brandfetchId = process.env.BRANDFETCH_CLIENT_ID?.trim()
  if (brandfetchId) {
    const url = `https://cdn.brandfetch.io/domain/${domain}/w/200/h/200?c=${brandfetchId}`
    return NextResponse.json({ url }, { headers: corsHeaders })
  }

  // Fallback to Clearbit when Brandfetch is not configured
  const clearbitUrl = `https://logo.clearbit.com/${domain}`
  return NextResponse.json({ url: clearbitUrl }, { headers: corsHeaders })
}
