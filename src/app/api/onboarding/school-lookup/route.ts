/**
 * School Lookup API Endpoint
 *
 * POST /api/onboarding/school-lookup
 *
 * Accepts a website URL and performs AI-powered extraction of school data
 * including contact information, logos, and institutional metadata.
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { lookupSchool } from '@/lib/services/schoolLookupService'
import { ok, fail } from '@/lib/api-response'

const SchoolLookupSchema = z.object({
  website: z.string().url('Invalid website URL').or(z.string().min(1, 'Website is required')),
})

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const ctx = await getUserContext(req)

    // Parse and validate request body
    const body = await req.json()
    const validation = SchoolLookupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const { website } = validation.data

    // Perform school lookup
    const schoolData = await lookupSchool(website)

    return NextResponse.json(ok(schoolData))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Authentication required'),
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('User not found')) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Invalid token'),
        { status: 401 }
      )
    }

    console.error('School lookup error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to lookup school information'),
      { status: 500 }
    )
  }
}
