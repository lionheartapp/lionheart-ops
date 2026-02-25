import { NextRequest, NextResponse } from 'next/server'
import { isSlugAvailable } from '@/lib/services/organizationRegistrationService'
import { ok, fail } from '@/lib/api-response'

/** GET /api/organizations/slug-check?slug=... */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  if (!slug) {
    return NextResponse.json(fail('BAD_REQUEST', 'slug query parameter is required'), { status: 400 })
  }
  const available = await isSlugAvailable(slug)
  return NextResponse.json(ok({ available }))
}
