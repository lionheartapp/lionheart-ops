/**
 * GET /api/cron/compliance-reminders — compliance reminder cron job
 *
 * Secured by CRON_SECRET in Authorization header.
 * Runs across all organizations (no org context).
 *
 * Sends 30-day and 7-day reminder emails to Maintenance Heads and Admins
 * for upcoming compliance deadlines.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { sendComplianceReminders } from '@/lib/services/complianceService'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    console.error('[cron/compliance-reminders] CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  let remindersSent = 0

  try {
    remindersSent = await sendComplianceReminders()
    console.log(`[cron/compliance-reminders] Reminders sent: ${remindersSent}`)
    return NextResponse.json(ok({ remindersSent }))
  } catch (error) {
    console.error('[cron/compliance-reminders] Fatal error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron job failed'), { status: 500 })
  }
}
