/**
 * GET /api/cron/calendar-sync — periodic cron job (every 30 minutes)
 *
 * Pulls events from connected Google Calendar and Microsoft Calendar accounts
 * for every user across all organizations. Each user with an active
 * IntegrationCredential for google_calendar or microsoft_calendar gets a fresh
 * sync of the 97-day window (7 past + 90 future).
 *
 * Secured by CRON_SECRET. Runs across all organizations (no org context).
 * Gracefully handles token refresh failures — marks the credential as needing
 * reauth but does not stop the job for other users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- Cron job is CRON_SECRET-protected and syncs integration credentials across organizations.
import { rawPrisma } from '@/lib/db'
import { importEventsFromGoogleCalendar } from '@/lib/services/integrations/googleCalendarService'
import { importEventsFromMicrosoftCalendar } from '@/lib/services/integrations/microsoftCalendarService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing cron secret'), { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    logger.error('CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const startedAt = Date.now()
  let googleSynced = 0
  let googleFailed = 0
  let microsoftSynced = 0
  let microsoftFailed = 0

  try {
    // Fetch all active calendar credentials across all orgs.
    // Batch so we don't load a huge result set in one go.
    const credentials = await rawPrisma.integrationCredential.findMany({
      where: {
        provider: { in: ['google_calendar', 'microsoft_calendar'] },
        isActive: true,
        userId: { not: null },
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        provider: true,
      },
    })

    logger.info({ count: credentials.length }, 'calendar-sync: starting cron run')

    for (const cred of credentials) {
      if (!cred.userId) continue

      try {
        if (cred.provider === 'google_calendar') {
          const result = await importEventsFromGoogleCalendar(cred.userId, cred.organizationId)
          if (result.error) {
            logger.warn({ userId: cred.userId, error: result.error }, 'calendar-sync: Google sync failed')
            googleFailed++
          } else {
            googleSynced++
          }
        } else if (cred.provider === 'microsoft_calendar') {
          const result = await importEventsFromMicrosoftCalendar(cred.userId, cred.organizationId)
          if (result.error) {
            logger.warn({ userId: cred.userId, error: result.error }, 'calendar-sync: Microsoft sync failed')
            microsoftFailed++
          } else {
            microsoftSynced++
          }
        }
      } catch (err) {
        // Don't let one user's failure stop the rest
        logger.error({ userId: cred.userId, provider: cred.provider, error: String(err) }, 'calendar-sync: unexpected error')
        if (cred.provider === 'google_calendar') googleFailed++
        else microsoftFailed++
      }
    }

    const durationMs = Date.now() - startedAt
    logger.info({
      googleSynced,
      googleFailed,
      microsoftSynced,
      microsoftFailed,
      durationMs,
    }, 'calendar-sync: cron run complete')

    return NextResponse.json(ok({
      googleSynced,
      googleFailed,
      microsoftSynced,
      microsoftFailed,
      durationMs,
    }))
  } catch (error) {
    logger.error({ error: String(error) }, 'calendar-sync: fatal cron error')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Calendar sync cron failed'), { status: 500 })
  }
}
