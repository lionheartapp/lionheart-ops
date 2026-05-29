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
import { logger } from '@/lib/logger'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const SchoolLookupSchema = z.object({
  website: z.string().url('Invalid website URL').or(z.string().min(1, 'Website is required')),
  schoolName: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    // Parse and validate request body
    const body = await req.json()
    const validation = SchoolLookupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const { website, schoolName } = validation.data

    // Perform school lookup
    const schoolData = await lookupSchool(website, schoolName)

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

    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Only workspace managers can lookup school information'), { status: 403 })
    }

    logger.error({ error: String(error) }, 'School lookup failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to lookup school information'),
      { status: 500 }
    )
  }
}
