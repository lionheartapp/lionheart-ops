/**
 * POST /api/webhooks/copyleaks/export-completed — all exports done
 *
 * Called once when all requested exports for a scan have been delivered.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const log = logger.child({ webhook: 'copyleaks-export-completed' })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    log.info({ scanId: body?.scanId }, 'All exports completed')
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'Export completed webhook failed')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
