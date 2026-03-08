/**
 * POST /api/webhooks/clever — Clever event webhook (public, no auth)
 */
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { handleCleverWebhook } from '@/lib/services/rosterSyncService'
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = body as { type?: string; data?: Record<string, unknown>; orgId?: string }
    if (!payload.type || !payload.orgId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Missing type or orgId'), { status: 400 })
    }
    // Verify org exists
    const org = await rawPrisma.organization.findUnique({ where: { id: payload.orgId } })
    if (!org) return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })

    await runWithOrgContext(payload.orgId, () =>
      handleCleverWebhook(payload, payload.orgId!)
    )
    return NextResponse.json(ok({ received: true }))
  } catch (error) {
    console.error('[POST /api/webhooks/clever]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook processing failed'), { status: 500 })
  }
}
