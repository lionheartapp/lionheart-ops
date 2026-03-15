/**
 * POST /api/events/projects/[id]/documents/reminders
 *
 * Sends reminder emails to families with incomplete required documents.
 * Optionally scoped to a single requirement via `requirementId` in the body.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { sendDocumentReminder } from '@/lib/services/eventDocumentService'

type RouteParams = {
  params: Promise<{ id: string }>
}

// ─── Validation Schema ────────────────────────────────────────────────────────

const SendReminderSchema = z.object({
  requirementId: z.string().min(1).optional(),
})

// ─── POST /api/events/projects/[id]/documents/reminders ──────────────────────

/**
 * Sends document reminder emails to all participants with incomplete required documents.
 *
 * Body (optional):
 * - requirementId: scope reminders to a specific document requirement
 *
 * Returns { sent: number } — count of emails sent successfully.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    // Body is optional — if no body or empty body, send to all with incomplete docs
    let options: { requirementId?: string } = {}
    try {
      const body = await req.json()
      const validated = SendReminderSchema.parse(body)
      options = validated
    } catch {
      // Empty body or parse failure — treat as "send to all"
    }

    return await runWithOrgContext(orgId, async () => {
      const sent = await sendDocumentReminder(id, options)
      return NextResponse.json(ok({ sent }))
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
