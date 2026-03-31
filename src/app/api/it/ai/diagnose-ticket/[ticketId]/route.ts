/**
 * POST /api/it/ai/diagnose-ticket/[ticketId] — run AI diagnostics on an IT ticket
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { diagnoseTicket } from '@/lib/services/itAIDiagnosticService'

export const POST = withAuth(async ({ params }) => {
  const result = await diagnoseTicket(params.ticketId)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_AI_DIAGNOSTIC })
