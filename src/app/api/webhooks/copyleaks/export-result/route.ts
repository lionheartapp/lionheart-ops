/**
 * POST /api/webhooks/copyleaks/export-result — individual match export
 *
 * Copyleaks calls this for each result being exported with detailed
 * character-level match positions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processExportedResult } from '@/lib/services/copyleaksService'
import { logger } from '@/lib/logger'

const log = logger.child({ webhook: 'copyleaks-export-result' })

export async function POST(req: NextRequest) {
  try {
    const scanId = req.headers.get('X-Scan-Id')
    const resultId = req.headers.get('X-Result-Id')
    const body = await req.json()

    if (!scanId || !resultId) {
      return NextResponse.json({ ok: false, error: 'Missing headers' }, { status: 400 })
    }

    log.info({ scanId, resultId }, 'Export result received')
    await processExportedResult(scanId, resultId, body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'Export result processing failed')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
