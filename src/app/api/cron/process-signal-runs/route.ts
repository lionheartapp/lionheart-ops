/**
 * GET /api/cron/process-signal-runs — process pending plagiarism signal runs
 *
 * Picks up SignalRun records with status=PENDING and type=WEB_VERBATIM,
 * submits them to Copyleaks for scanning, and marks them as RUNNING.
 *
 * Other signal types (DRAFTING_TIMELINE, WRITING_FINGERPRINT, STYLISTIC_PATTERNS)
 * are skipped for now — they'll be processed by dedicated workers later.
 *
 * Secured by CRON_SECRET in the Authorization header.
 * Schedule: every 1 minute via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { submitScan } from '@/lib/services/copyleaksService'
import { logger } from '@/lib/logger'

const log = logger.child({ cron: 'process-signal-runs' })

// Process up to 5 scans per invocation to stay within API rate limits
const BATCH_SIZE = 5

export async function GET(req: NextRequest) {
  // ─── Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
    return NextResponse.json(
      fail('CONFIGURATION_ERROR', 'Cron secret not configured'),
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Invalid or missing cron secret'),
      { status: 401 }
    )
  }

  // ─── Check if Copyleaks is configured ──────────────────────────────
  if (!process.env.COPYLEAKS_API_EMAIL || !process.env.COPYLEAKS_API_KEY) {
    log.warn('Copyleaks not configured — skipping signal run processing')
    return NextResponse.json(ok({ processed: 0, skipped: 'copyleaks_not_configured' }))
  }

  try {
    // Pick up pending WEB_VERBATIM runs (oldest first)
    const pendingRuns = await rawPrisma.signalRun.findMany({
      where: {
        status: 'PENDING',
        type: 'WEB_VERBATIM',
      },
      include: {
        submission: {
          select: { contentText: true, contentHash: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    })

    if (pendingRuns.length === 0) {
      return NextResponse.json(ok({ processed: 0 }))
    }

    log.info({ count: pendingRuns.length }, 'Processing pending signal runs')

    let processed = 0
    let failed = 0

    // Use sandbox mode in development
    const useSandbox = process.env.NODE_ENV === 'development'

    for (const run of pendingRuns) {
      try {
        // Mark as RUNNING before submitting
        await rawPrisma.signalRun.update({
          where: { id: run.id },
          data: {
            status: 'RUNNING',
            startedAt: new Date(),
          },
        })

        // Submit to Copyleaks
        await submitScan(run.id, run.submission.contentText, useSandbox)
        processed++
      } catch (error) {
        failed++
        log.error({ err: error, signalRunId: run.id }, 'Failed to submit scan')

        // Mark as FAILED so we don't retry endlessly
        await rawPrisma.signalRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    }

    // Skip non-verbatim signal types for now — mark as SKIPPED
    const otherPending = await rawPrisma.signalRun.updateMany({
      where: {
        status: 'PENDING',
        type: { in: ['DRAFTING_TIMELINE', 'WRITING_FINGERPRINT', 'STYLISTIC_PATTERNS'] },
      },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
        errorMessage: 'Signal type not yet implemented',
      },
    })

    log.info(
      { processed, failed, skippedOtherTypes: otherPending.count },
      'Signal run processing complete'
    )

    return NextResponse.json(ok({ processed, failed, skippedOtherTypes: otherPending.count }))
  } catch (error) {
    log.error({ err: error }, 'Signal run cron failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Signal run processing failed'),
      { status: 500 }
    )
  }
}
