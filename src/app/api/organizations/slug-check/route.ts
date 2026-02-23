/**
 * Slug Validation API
 * 
 * Checks if a proposed organization slug is valid and available.
 * Used for real-time validation during signup form.
 * 
 * GET /api/organizations/slug-check?slug=demo-academy
 * Returns: { valid: true } or { valid: false, reason: "slug already taken" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { organizationRegistrationService } from '@/lib/services'
import { ok, fail } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Slug parameter is required'),
        { status: 400 }
      )
    }

    const result = await organizationRegistrationService.validateSlug(slug)

    if (result.valid) {
      return NextResponse.json(ok({ valid: true, slug: slug.toLowerCase() }))
    } else {
      return NextResponse.json(
        ok({
          valid: false,
          reason: result.reason,
        })
      )
    }
  } catch (error) {
    console.error('Slug validation error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to validate slug'),
      { status: 500 }
    )
  }
}
