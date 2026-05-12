/**
 * POST /api/webhooks/copyleaks/export-crawled — crawled version of submitted text
 *
 * Receives the processed version of the submitted document. We log it
 * but don't store it — the original contentText is already in the DB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const log = logger.child({ webhook: 'copyleaks-export-crawled' })

export async function POST(req: NextRequest) {
  try {
    const scanId = req.headers.get('X-Scan-Id')
    log.info({ scanId }, 'Crawled version received')
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'Export crawled webhook failed')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
