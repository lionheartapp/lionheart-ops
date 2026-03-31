/**
 * GET   /api/events/projects/[id]/documents/completions  — get document matrix
 * PATCH /api/events/projects/[id]/documents/completions  — toggle completion
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getDocumentMatrix,
  toggleCompletion,
} from '@/lib/services/eventDocumentService'

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
export const GET = withAuth(async ({ params }) => {
  const matrix = await getDocumentMatrix(params.id)
  return NextResponse.json(ok(matrix))
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE })

// ─── PATCH /api/events/projects/[id]/documents/completions ───────────────────

/**
 * Toggles document completion for a specific registration + requirement pair.
 */
export const PATCH = withAuth(async ({ body }) => {
  const completion = await toggleCompletion(body.registrationId, body.requirementId, body.isComplete)
  return NextResponse.json(ok(completion))
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE, schema: ToggleCompletionSchema })
