/**
 * POST /api/webhooks/classlink — ClassLink event webhook (public, no auth)
 */
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { handleClassLinkWebhook } from '@/lib/services/rosterSyncService'
// eslint-disable-next-line no-restricted-imports -- Public ClassLink webhook verifies HMAC signature before resolving org and entering org context.
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { verifyHmacSha256 } from '@/lib/webhook-verify'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    // Check signature header before reading body or checking config
    const signature =
      req.headers.get('x-classlink-signature') || req.headers.get('classlink-signature')
    if (!signature) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Missing webhook signature'), { status: 401 })
    }

    const classLinkSecret = process.env.CLASSLINK_WEBHOOK_SECRET
    if (!classLinkSecret) {
      logger.error('CLASSLINK_WEBHOOK_SECRET not configured')
      return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook endpoint not configured'), { status: 500 })
    }

    // Read raw body before any parsing (body stream can only be consumed once)
    const rawBody = await req.text()

    const isValid = verifyHmacSha256(rawBody, signature, classLinkSecret)
    if (!isValid) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid webhook signature'), { status: 401 })
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
    logger.error({ error: String(error) }, 'Webhook processing failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook processing failed'), { status: 500 })
  }
}
