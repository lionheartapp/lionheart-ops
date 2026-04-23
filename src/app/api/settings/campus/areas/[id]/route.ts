import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'

/**
 * DEPRECATED (Phase 1b): The `Area` model has been renamed to `Space`.
 * Use `/api/settings/campus/spaces/:id` instead.
 */
function gone() {
  return NextResponse.json(
    fail(
      'GONE',
      'The areas endpoint has been renamed. Use /api/settings/campus/spaces/:id instead.',
    ),
    { status: 410 },
  )
}

export function GET() {
  return gone()
}

export function PATCH() {
  return gone()
}

export function DELETE() {
  return gone()
}
