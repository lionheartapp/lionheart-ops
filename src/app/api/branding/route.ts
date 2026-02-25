import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationBranding } from '@/lib/services/organizationService'
import { ok, fail } from '@/lib/api-response'

/** GET /api/branding?slug=... — public branding for an organization by slug. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  if (!slug) {
    return NextResponse.json(fail('BAD_REQUEST', 'slug query parameter is required'), { status: 400 })
  }

  const branding = await getOrganizationBranding(slug)
  if (!branding) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  return NextResponse.json(ok(branding))
}
