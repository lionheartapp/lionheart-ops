import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import {
  validateWebhookSignature,
  transformBarkPayload,
  processFilterEvent,
} from '@/lib/services/itContentFilterService'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const orgId = url.searchParams.get('org')
    if (!orgId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Missing org query parameter'), { status: 400 })
    }

    const rawBody = await req.text()
    const signature = req.headers.get('x-bark-signature') || ''

    const config = await (rawPrisma.iTContentFilterConfig as unknown as PrismaDelegate).findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: 'BARK' } },
    })
    if (!config || !config.isEnabled) {
      return NextResponse.json(fail('NOT_FOUND', 'Provider not configured'), { status: 404 })
    }

    if (config.webhookSecret) {
      if (!signature || !validateWebhookSignature(rawBody, signature, config.webhookSecret)) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid or missing signature'), { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)
    const normalized = transformBarkPayload(payload)
    await processFilterEvent(orgId, 'BARK', normalized)

    return NextResponse.json(ok({ received: true }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Bark webhook processing failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Webhook processing failed'), { status: 500 })
  }
}
