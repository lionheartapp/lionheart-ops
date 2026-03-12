/**
 * POST /api/ai/assistant/confirm — Execute a confirmed AI assistant action
 *
 * After the AI drafts an action and the user confirms via the UI,
 * this endpoint actually performs the write operation using action-handlers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { executeAction } from '@/lib/services/ai/action-handlers'

const ConfirmSchema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { action, payload } = ConfirmSchema.parse(await req.json())

    return await runWithOrgContext(orgId, async () => {
      try {
        const result = await executeAction(action, payload, { userId: ctx.userId, organizationId: orgId })
        return NextResponse.json(ok({ success: true, message: result.message }))
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unknown action')) {
          return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
        }
        throw error
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request'), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/ai/assistant/confirm]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
