/**
 * POST /api/events/projects/[id]/documents/reminders
 *
 * Sends reminder emails to families with incomplete required documents.
 * Optionally scoped to a single requirement via `requirementId` in the body.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { sendDocumentReminder } from '@/lib/services/eventDocumentService'

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
export const POST = withAuth(async ({ req, params }) => {
  const id = params.id

  // Body is optional — if no body or empty body, send to all with incomplete docs
  let options: { requirementId?: string } = {}
  try {
    const body = await req.json()
    const validated = SendReminderSchema.parse(body)
    options = validated
  } catch {
    // Empty body or parse failure — treat as "send to all"
  }

  const sent = await sendDocumentReminder(id, options)
  return NextResponse.json(ok({ sent }))
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE })
