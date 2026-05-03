/**
 * GET /api/cron/automations
 *
 * Runs all scheduled automations:
 * - Registration reminders (7 days and 24 hours before event)
 * - Stale ticket escalation (open > 3 days)
 * - Approval gate timeout reminders (pending > 72 hours)
 *
 * Called by Vercel Cron (configured in vercel.json) or manually.
 * Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runAllAutomations } from '@/lib/services/automationService'
import { logger } from '@/lib/logger'

const log = logger.child({ route: '/api/cron/automations' })

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing cron secret'), { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log.error('CRON_SECRET is not configured')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron endpoint not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  try {
    const results = await runAllAutomations()
    log.info(results, 'Cron automations completed')
    return NextResponse.json(ok(results))
  } catch (error) {
    log.error({ err: error }, 'Cron automations failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Automation run failed'),
      { status: 500 },
    )
  }
}
