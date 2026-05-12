/**
 * POST /api/webhooks/copyleaks/:status — Copyleaks scan status webhook
 *
 * Copyleaks calls this when a scan status changes. The {STATUS} token in the
 * webhook URL is replaced with: completed, error, creditsChecked, or indexed.
 *
 * No auth header — Copyleaks doesn't support custom auth on webhooks.
 * Security: the scanId must match a SignalRun in our DB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processCompletedScan, processFailedScan } from '@/lib/services/copyleaksService'
import { logger } from '@/lib/logger'

const log = logger.child({ webhook: 'copyleaks-status' })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  try {
    const { status } = await params
    const body = await req.json()
    const scanId = body?.scannedDocument?.scanId || body?.scanId

    log.info({ status, scanId }, 'Copyleaks webhook received')

    if (!scanId) {
      return NextResponse.json({ ok: false, error: 'Missing scanId' }, { status: 400 })
    }

    switch (status) {
      case 'completed':
        await processCompletedScan(scanId, body)
        break

      case 'error':
        await processFailedScan(scanId, body?.error?.message || 'Unknown error from Copyleaks')
        break

      case 'creditsChecked':
        log.info({ scanId, credits: body?.credits }, 'Credits check completed')
        break

      case 'indexed':
        log.info({ scanId }, 'Document indexed')
        break

      default:
        log.warn({ status, scanId }, 'Unknown Copyleaks webhook status')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ err: error }, 'Copyleaks webhook processing failed')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
