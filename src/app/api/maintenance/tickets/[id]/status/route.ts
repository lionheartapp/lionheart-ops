/**
 * PATCH /api/maintenance/tickets/[id]/status — transition ticket status
 *
 * Enforces the ALLOWED_TRANSITIONS state machine.
 * Returns 400 INVALID_TRANSITION for disallowed moves.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { transitionTicketStatus } from '@/lib/services/maintenanceTicketService'
import type { MaintenanceTicketStatus, HoldReason } from '@prisma/client'

export const PATCH = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const { status, holdReason, holdNote, completionNote, completionPhotos, cancellationReason, rejectionNote, comment } = body

  if (!status) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'status is required'), { status: 400 })
  }

  try {
    const updated = await transitionTicketStatus(
      params.id,
      status as MaintenanceTicketStatus,
      {
        holdReason: holdReason as HoldReason | undefined,
        holdNote,
        completionNote,
        completionPhotos,
        cancellationReason,
        rejectionNote,
        comment,
      },
      { userId: ctx.userId, organizationId: orgId }
    )

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('INVALID_TRANSITION')) {
        return NextResponse.json(
          fail('INVALID_TRANSITION', error.message.replace('INVALID_TRANSITION: ', '')),
          { status: 400 }
        )
      }
      if (error.message.startsWith('MISSING_FIELD')) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', error.message.replace('MISSING_FIELD: ', '')),
          { status: 400 }
        )
      }
    }
    throw error
  }
})
