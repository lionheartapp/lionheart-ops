/**
 * POST /api/webhooks/copyleaks/new-result — live result streaming
 *
 * Called as new matches are found during a running scan.
 * We acknowledge receipt but wait for the `completed` webhook
 * to process all results together.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const log = logger.child({ webhook: 'copyleaks-new-result' })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    log.debug({ scanId: body?.scanId }, 'New result streamed')
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'New result webhook failed')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
