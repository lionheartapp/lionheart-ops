/**
 * POST /api/cron/form-reminders — Send reminders for pending form submissions
 *
 * Runs daily via Vercel Cron. Finds forms with pending submissions
 * older than the configured reminder cadence (1, 3, 7 days) and creates
 * reminder notifications for form owners.
 *
 * Secured by CRON_SECRET in the Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'cron:form-reminders' })

// Reminder thresholds in days
const REMINDER_DAYS = [1, 3, 7]

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing cron secret'), { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  try {
    const now = new Date()
    let remindersCreated = 0

    // Find submissions in PENDING_APPROVAL status that are overdue
    for (const days of REMINDER_DAYS) {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      const overdueSubmissions = await rawPrisma.formSubmission.findMany({
        where: {
          status: 'PENDING_APPROVAL',
          isDraft: false,
          deletedAt: null,
          createdAt: { lt: cutoff },
        },
        select: {
          id: true,
          formId: true,
          organizationId: true,
          submitterName: true,
          form: { select: { description: true, createdBy: true } },
        },
      })

      for (const sub of overdueSubmissions) {
        // Only remind the form creator (if known)
        if (!sub.form.createdBy) continue

        // Check if we already sent a reminder for this submission
        const reminderTag = `form-reminder:${sub.id}`
        const existingReminder = await rawPrisma.notification.findFirst({
          where: {
            userId: sub.form.createdBy,
            type: 'FORM_REMINDER',
            linkUrl: reminderTag,
          },
          select: { id: true },
        })

        if (existingReminder) continue

        await rawPrisma.notification.create({
          data: {
            organizationId: sub.organizationId,
            userId: sub.form.createdBy,
            type: 'FORM_REMINDER',
            title: `Pending approval: ${sub.form.description || 'Form submission'}`,
            body: `A submission from ${sub.submitterName || 'someone'} has been waiting ${days} day${days === 1 ? '' : 's'} for review.`,
            linkUrl: reminderTag,
          },
        })

        remindersCreated++
      }
    }

    log.info({ remindersCreated }, 'Form reminders processed')

    return NextResponse.json(ok({ remindersCreated }))
  } catch (err) {
    log.error({ err }, 'Form reminders failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Reminders failed'), { status: 500 })
  }
}
