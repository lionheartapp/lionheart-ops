/**
 * POST /api/webhooks/classlink — ClassLink event webhook (public, no auth)
 */
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { handleClassLinkWebhook } from '@/lib/services/rosterSyncService'
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { verifyHmacSha256 } from '@/lib/webhook-verify'

export async function POST(req: NextRequest) {
  try {
    const classLinkSecret = process.env.CLASSLINK_WEBHOOK_SECRET

    // Read raw body before any parsing (body stream can only be consumed once)
    const rawBody = await req.text()

    if (!classLinkSecret) {
      // Graceful degradation: log warning and skip verification when secret not configured
      console.warn('[ClassLink webhook] CLASSLINK_WEBHOOK_SECRET not configured — skipping signature verification')
    } else {
      const signature =
        req.headers.get('x-classlink-signature') || req.headers.get('classlink-signature')

      if (!signature) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Missing webhook signature'), { status: 401 })
      }

      const isValid = verifyHmacSha256(rawBody, signature, classLinkSecret)
      if (!isValid) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid webhook signature'), { status: 401 })
      }
    }

    // Parse body from raw text (stream already consumed above)
    const body = JSON.parse(rawBody)
    const payload = body as { type?: string; data?: Record<string, unknown>; orgId?: string }

    if (!payload.type || !payload.orgId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Missing type or orgId'), { status: 400 })
    }
    const org = await rawPrisma.organization.findUnique({ where: { id: payload.orgId } })
    if (!org) return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })

    await runWithOrgContext(payload.orgId, () =>
      handleClassLinkWebhook(payload, payload.orgId!)
    )
    return NextResponse.json(ok({ received: true }))
  } catch (error) {
    console.error('[POST /api/webhooks/classlink]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook processing failed'), { status: 500 })
  }
}
