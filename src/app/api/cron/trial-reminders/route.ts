/**
 * GET /api/cron/trial-reminders — daily trial reminder cron job
 *
 * Secured by CRON_SECRET in the Authorization header. Runs across all
 * organizations (no org context needed) and sends two reminders:
 *
 *   • 9 days before trial end  ("one week left")
 *   • 2 days before trial end  ("final reminder")
 *
 * Idempotency is tracked on Organization via trialReminder21SentAt /
 * trialReminder28SentAt so re-runs on the same day don't double-send.
 *
 * Orgs that already have a paid subscription (ACTIVE or PAST_DUE) are
 * excluded — they've already upgraded.
 */

import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Cron job is CRON_SECRET-protected and sends trial reminders across organizations.
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { logger } from '@/lib/logger'

const log = logger.child({ cron: 'trial-reminders' })

interface ReminderTarget {
  id: string
  name: string
  slug: string
  email: string
  daysLeft: number
  milestone: '9-day' | '2-day'
}

function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY)
}

/** Returns the canonical app URL (falls back to production hostname). */
function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'https://app.lionheartapp.com'
  )
}

function buildReminderEmail(target: ReminderTarget): {
  subject: string
  html: string
  text: string
} {
  const upgradeUrl = `${getAppUrl()}/onboarding/plan`
  const settingsUrl = `${getAppUrl()}/settings?tab=billing`
  const urgency = target.milestone === '2-day' ? 'final reminder' : 'heads up'
  const daysCopy = target.daysLeft === 1 ? '1 day' : `${target.daysLeft} days`

  const subject =
    target.milestone === '2-day'
      ? `Final reminder: ${daysCopy} left on your Lionheart trial`
      : `${daysCopy} left on your Lionheart free trial`

  const text = `Hi ${target.name},

This is a ${urgency} that your free trial for ${target.name} on Lionheart ends in ${daysCopy}.

When the trial ends, your workspace will switch to read-only mode until you pick a plan. You won't lose any data — you just won't be able to make new changes until you upgrade.

Pick a plan: ${upgradeUrl}
Manage billing: ${settingsUrl}

Questions? Just reply to this email.

— The Lionheart team
`

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">${daysCopy} left on your free trial</h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    Hi ${target.name},
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    Your free trial for <strong>${target.name}</strong> on Lionheart ends in
    <strong>${daysCopy}</strong>. When the trial ends your workspace switches
    to read-only mode until you pick a plan — you won't lose any data.
  </p>
  <p style="margin: 24px 0;">
    <a href="${upgradeUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Pick a plan
    </a>
  </p>
  <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 32px;">
    Questions? Just reply to this email.<br/>
    — The Lionheart team
  </p>
</body>
</html>`

  return { subject, html, text }
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'

  if (!apiKey) {
    log.warn('RESEND_API_KEY not set — skipping send')
    return { sent: false, reason: 'RESEND_NOT_CONFIGURED' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    })
    if (!res.ok) {
      const body = await res.text()
      log.error({ status: res.status, body }, 'Resend API returned non-OK')
      return { sent: false, reason: 'RESEND_SEND_FAILED' }
    }
    return { sent: true }
  } catch (error) {
    log.error({ err: String(error) }, 'Resend fetch failed')
    return { sent: false, reason: 'RESEND_SEND_FAILED' }
  }
}

export async function GET(req: NextRequest) {
  // Auth: cron secret
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Missing cron secret'),
      { status: 401 }
    )
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
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

  const now = new Date()

  try {
    // Pull every org still inside a trial window without a paid subscription.
    // We do the window math in JS so we can include both the 9-day and 2-day
    // milestones in a single query.
    // Principal contact info moved off Organization and onto School in Phase 1c
    // ontology inversion. For trial reminders we need a real human email, so we
    // look up either:
    //   1. The principal on the org's first (default) School, or
    //   2. The first super-admin / admin user as a fallback.
    const candidates = await rawPrisma.organization.findMany({
      where: {
        trialEndsAt: { gt: now },
        // Skip orgs that already upgraded
        subscriptions: {
          none: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        trialEndsAt: true,
        trialReminder21SentAt: true,
        trialReminder28SentAt: true,
        schools: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: { principalName: true, principalEmail: true },
        },
        users: {
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            userRole: { slug: { in: ['super-admin', 'admin'] } },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { name: true, email: true },
        },
      },
    })

    const targets: ReminderTarget[] = []

    for (const org of candidates) {
      const primarySchool = org.schools[0]
      const primaryAdmin = org.users[0]
      const contactEmail = primarySchool?.principalEmail ?? primaryAdmin?.email ?? null

      if (!org.trialEndsAt || !contactEmail) continue
      const daysLeft = daysBetween(now, org.trialEndsAt)

      // 2-day reminder has priority if both windows match (close to expiry).
      if (daysLeft <= 2 && daysLeft > 0 && !org.trialReminder28SentAt) {
        targets.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          email: contactEmail,
          daysLeft,
          milestone: '2-day',
        })
      } else if (daysLeft <= 9 && daysLeft > 2 && !org.trialReminder21SentAt) {
        targets.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          email: contactEmail,
          daysLeft,
          milestone: '9-day',
        })
      }
    }

    let sent = 0
    let failed = 0

    for (const target of targets) {
      const { subject, html, text } = buildReminderEmail(target)
      const result = await sendEmail(target.email, subject, html, text)

      if (result.sent) {
        sent++
        await rawPrisma.organization.update({
          where: { id: target.id },
          data:
            target.milestone === '2-day'
              ? { trialReminder28SentAt: new Date() }
              : { trialReminder21SentAt: new Date() },
        })
      } else {
        failed++
      }
    }

    log.info({ considered: candidates.length, sent, failed }, 'Trial reminders sent')
    return NextResponse.json(ok({ considered: candidates.length, sent, failed }))
  } catch (error) {
    log.error({ err: String(error) }, 'Trial reminder cron failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Cron job failed'),
      { status: 500 }
    )
  }
}
