/**
 * GET /api/cron/event-notifications — cron job for event notification dispatch
 *
 * Secured by CRON_SECRET in Authorization header.
 * Runs across all organizations (no org context — uses rawPrisma internally).
 *
 * Finds all APPROVED EventNotificationRule records where scheduledAt <= now()
 * and sentAt IS NULL, dispatches in-app notifications, marks rules as SENT,
 * and creates EventNotificationLog entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { dispatchPendingNotifications } from '@/lib/services/notificationOrchestrationService'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    console.error('[cron/event-notifications] CRON_SECRET not configured')
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
    console.log(`[cron/event-notifications] Dispatched ${dispatched} notification rule(s)`)
    return NextResponse.json(ok({ dispatched }))
  } catch (error) {
    console.error('[cron/event-notifications] Fatal error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Cron job failed'),
      { status: 500 }
    )
  }
}
