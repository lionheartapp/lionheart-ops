import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { approveGate } from '@/lib/services/eventProjectService'

const schema = z.object({
  gateType: z.enum(['admin', 'facilities', 'av', 'custodial', 'security']),
})

/**
 * POST /api/events/projects/[id]/approve-gate
 *
 * Approves a specific approval gate (av, facilities, or admin) on an EventProject.
 * Admin gate can only be approved after AV/Facilities gates are cleared.
 * If all gates are approved, the event transitions to CONFIRMED.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  try {
    const result = await approveGate(params.id, body.gateType, ctx.userId)
    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Cannot approve') ||
      error.message.includes('No ') ||
      error.message.includes('Waiting on')
    )) {
      return NextResponse.json(fail('INVALID_STATE', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENT_PROJECT_APPROVE, schema })
