import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'

/**
 * DEPRECATED (Phase 1b): UserCampusAssignment junction table has been dropped.
 * Users are now pinned to a single campus via User.campusId.
 *
 * Use PATCH /api/settings/users/:id to update a user's campusId instead.
 */
export function GET() {
  return NextResponse.json(
    fail(
      'GONE',
      'Campus assignments endpoint has been retired. Update users.campusId directly via /api/settings/users.',
    ),
    { status: 410 },
  )
}

export function POST() {
  return NextResponse.json(
    fail(
      'GONE',
      'Campus assignments endpoint has been retired. Update users.campusId directly via /api/settings/users.',
    ),
    { status: 410 },
  )
}
