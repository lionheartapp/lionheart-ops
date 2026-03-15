/**
 * GET   /api/events/projects/[id]/documents/completions  — get document matrix
 * PATCH /api/events/projects/[id]/documents/completions  — toggle completion
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getDocumentMatrix,
  toggleCompletion,
} from '@/lib/services/eventDocumentService'

type RouteParams = {
  params: Promise<{ id: string }>
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const ToggleCompletionSchema = z.object({
  registrationId: z.string().min(1),
  requirementId: z.string().min(1),
  isComplete: z.boolean(),
})

// ─── GET /api/events/projects/[id]/documents/completions ─────────────────────

/**
 * Returns the full document completion matrix for all REGISTERED participants.
 *
 * Response shape:
 * {
 *   requirements: EventDocumentRequirement[],
 *   participants: [{
 *     registrationId, firstName, lastName, photoUrl, email,
 *     completions: [{ requirementId, isComplete, completedAt, fileUrl, notes }],
 *     completedCount, totalCount, isFullyComplete
 *   }]
 * }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const matrix = await getDocumentMatrix(id)
      return NextResponse.json(ok(matrix))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}

// ─── PATCH /api/events/projects/[id]/documents/completions ───────────────────

/**
 * Toggles document completion for a specific registration + requirement pair.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _projectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    const body = await req.json()
    const { registrationId, requirementId, isComplete } = ToggleCompletionSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const completion = await toggleCompletion(registrationId, requirementId, isComplete)
      return NextResponse.json(ok(completion))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), {
        status: 400,
      })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}
