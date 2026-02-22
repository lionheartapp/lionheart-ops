import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

/** Default stock image for school login pages (generic campus/school) */
const DEFAULT_LOGIN_HERO =
  'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80'

/**
 * GET /api/public/org-branding?subdomain=linfield
 * Returns public branding for a school's subdomain login page.
 * No auth required. Used when user visits linfield.lionheartapp.com/login
 */
export async function GET(req: NextRequest) {
  try {
    const subdomain = req.nextUrl.searchParams.get('subdomain')?.trim().toLowerCase()
    if (!subdomain) {
      return NextResponse.json(
        { error: 'Missing subdomain' },
        { status: 400, headers: corsHeaders }
      )
    }

    const org = await prismaBase.organization.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        website: true,
        settings: true,
      },
    })

    if (!org) {
      return NextResponse.json(
        { error: 'School not found', found: false },
        { status: 404, headers: corsHeaders }
      )
    }

    const settings = org.settings && typeof org.settings === 'object'
      ? (org.settings as Record<string, unknown>)
      : {}
    const branding = settings.branding && typeof settings.branding === 'object'
      ? (settings.branding as Record<string, unknown>)
      : {}
    const colors = branding.colors && typeof branding.colors === 'object'
      ? (branding.colors as { primary?: string; secondary?: string })
      : {}

    return NextResponse.json(
      {
        found: true,
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl || null,
        website: org.website || null,
        primaryColor: colors.primary || '#1a365d',
        secondaryColor: colors.secondary || '#3182ce',
        loginHeroImageUrl: (branding.loginHeroImageUrl as string) || DEFAULT_LOGIN_HERO,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('public/org-branding error:', err)
    return NextResponse.json(
      { error: 'Failed to load branding' },
      { status: 500, headers: corsHeaders }
    )
  }
}
