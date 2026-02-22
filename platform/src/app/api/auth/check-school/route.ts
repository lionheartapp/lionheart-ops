import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

function extractDomain(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const u = url.startsWith('http') ? url : `https://${url}`
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * GET /api/auth/check-school?name=...&website=...
 * Returns matching schools so user can confirm which one (or create new).
 * Use website/domain to narrow results when multiple schools share a name.
 */
export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get('name')?.trim()
    const websiteParam = req.nextUrl.searchParams.get('website')?.trim()
    const domain = extractDomain(websiteParam)

    if (!name || name.length < 2) {
      return NextResponse.json(
        { exists: false, matches: [] },
        { headers: corsHeaders }
      )
    }

    const searchTerm = name.toLowerCase()

    // Find orgs whose name contains the search (e.g. "Lincoln" matches "Lincoln Academy")
    const matches = await prismaBase.organization.findMany({
      where: {
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: { id: true, name: true, slug: true, website: true },
      take: 5,
    })

    // If domain provided, prefer matches with that website
    let ranked = matches
    if (domain && matches.length > 1) {
      const withDomain = matches.filter((m) => {
        const mDomain = extractDomain(m.website)
        return mDomain && (mDomain.includes(domain) || domain.includes(mDomain))
      })
      if (withDomain.length > 0) ranked = withDomain
    }

    const result = ranked.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      website: m.website || undefined,
      domain: extractDomain(m.website) || undefined,
    }))

    return NextResponse.json(
      { exists: result.length > 0, matches: result },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('check-school error:', err)
    return NextResponse.json(
      { exists: false, matches: [] },
      { status: 500, headers: corsHeaders }
    )
  }
}
