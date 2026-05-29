/**
 * GET /api/cron/event-notifications — cron job for event notification dispatch
 *
 * Secured by CRON_SECRET in Authorization header.
 * Runs across all organizations through the notification orchestration service.
 *
 * Finds all APPROVED EventNotificationRule records where scheduledAt <= now()
 * and sentAt IS NULL, dispatches in-app notifications, marks rules as SENT,
 * and creates EventNotificationLog entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { dispatchPendingNotifications } from '@/lib/services/notificationOrchestrationService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Missing cron secret'),
      { status: 401 }
    )
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    logger.error('CRON_SECRET not configured')
    return NextResponse.json(
      fail('CONFIGURATION_ERROR', 'Cron not configured'),
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Invalid cron secret'),
      { status: 401 }
    )
  }

  try {
    const dispatched = await dispatchPendingNotifications()
    logger.info({ dispatched }, 'Dispatched notification rules')
    return NextResponse.json(ok({ dispatched }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Fatal error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Cron job failed'),
      { status: 500 }
    )
  }
}
