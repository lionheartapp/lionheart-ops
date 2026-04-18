/**
 * Google Calendar Integration Service
 *
 * Handles per-user OAuth authorization and event push/removal.
 * Uses googleapis npm package for the Calendar API v3 client.
 * All functions gracefully return null if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.
 */

import { google, calendar_v3 } from 'googleapis'
import { rawPrisma } from '@/lib/db'
import type { GoogleCalendarEvent } from '@/lib/types/integrations'
import type { EventProject } from '@prisma/client'

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ─── Availability check ──────────────────────────────────────────────────────

export function isAvailable(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

// ─── OAuth2 client factory ───────────────────────────────────────────────────

/**
 * Returns the fixed redirect URI for Google OAuth.
 * Uses NEXT_PUBLIC_APP_URL so a single URI works for all tenant subdomains.
 * This must match what's registered in Google Cloud Console.
 */
function getRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/integrations/google-calendar/callback`
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  )
}

// ─── OAuth state encoding ───────────────────────────────────────────────────

/** Encode userId + tenant origin into the OAuth state parameter. */
export function encodeOAuthState(userId: string, tenantOrigin?: string): string {
  return Buffer.from(JSON.stringify({ userId, origin: tenantOrigin || '' })).toString('base64url')
}

/** Decode the OAuth state parameter back to userId + tenant origin. */
export function decodeOAuthState(state: string): { userId: string; origin: string } {
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    return { userId: parsed.userId || '', origin: parsed.origin || '' }
  } catch {
    // Backwards compat: old state was just the raw userId string
    return { userId: state, origin: '' }
  }
}

// ─── Auth URL ────────────────────────────────────────────────────────────────

/**
 * Returns the Google OAuth authorization URL for a per-user calendar connection.
 * Returns null if Google credentials are not configured.
 * @param tenantOrigin - The tenant's subdomain origin (e.g. https://school.lionheartapp.com)
 *   so the callback can redirect back to the correct subdomain.
 */
export function getAuthUrl(userId: string, tenantOrigin?: string): string | null {
  if (!isAvailable()) return null

  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state: encodeOAuthState(userId, tenantOrigin),
  })
}

// ─── Callback handler ────────────────────────────────────────────────────────

/**
 * Exchanges OAuth code for tokens and stores them in IntegrationCredential for the user.
 */
export async function handleCallback(
  userId: string,
  organizationId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isAvailable()) {
    return { success: false, error: 'Google Calendar credentials not configured' }
  }

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      return { success: false, error: 'No access token received from Google' }
    }

    // Fetch user's Google email for display
    oauth2Client.setCredentials(tokens)
    let googleEmail: string | null = null
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const userInfo = await oauth2.userinfo.get()
      googleEmail = userInfo.data.email || null
    } catch {
      // Non-fatal — display name is optional
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000)

    await rawPrisma.integrationCredential.upsert({
      where: {
        organizationId_provider_userId: {
          organizationId,
          provider: 'google_calendar',
          userId,
        },
      },
      create: {
        organizationId,
        userId,
        provider: 'google_calendar',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: expiresAt,
        config: { googleEmail },
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        config: { googleEmail },
        isActive: true,
        updatedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Google Calendar callback',
    }
  }
}

// ─── Token refresh ───────────────────────────────────────────────────────────

/**
 * Checks tokenExpiresAt and refreshes if < 5 min remaining.
 * Returns a configured OAuth2 client or null if not possible.
 */
export async function refreshTokenIfNeeded(credentialId: string): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const cred = await rawPrisma.integrationCredential.findUnique({
    where: { id: credentialId },
  })

  if (!cred || !cred.accessToken) return null

  const oauth2Client = createOAuth2Client()
  const needsRefresh =
    cred.tokenExpiresAt && cred.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) {
    oauth2Client.setCredentials({
      access_token: cred.accessToken,
      refresh_token: cred.refreshToken || undefined,
    })
    return oauth2Client
  }

  if (!cred.refreshToken) {
    // Cannot refresh without refresh token
    oauth2Client.setCredentials({ access_token: cred.accessToken })
    return oauth2Client
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cred.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }).toString(),
    })

    if (!response.ok) {
      // Fallback to old token
      oauth2Client.setCredentials({ access_token: cred.accessToken })
      return oauth2Client
    }

    const tokenData = await response.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000)

    await rawPrisma.integrationCredential.update({
      where: { id: credentialId },
      data: {
        accessToken: tokenData.access_token,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    })

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: cred.refreshToken,
    })
    return oauth2Client
  } catch {
    oauth2Client.setCredentials({ access_token: cred.accessToken })
    return oauth2Client
  }
}

// ─── Sync event to calendar ──────────────────────────────────────────────────

/**
 * Creates or updates a Google Calendar event for the given EventProject.
 * Stores the Google event ID in the credential's metadata for future updates.
 */
export async function syncEventToCalendar(
  userId: string,
  organizationId: string,
  eventProject: EventProject
): Promise<GoogleCalendarEvent | null> {
  if (!isAvailable()) return null

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, userId, provider: 'google_calendar', isActive: true },
  })

  if (!cred) return null

  try {
    const oauth2Client = await refreshTokenIfNeeded(cred.id)
    if (!oauth2Client) return null

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Build Google Calendar event
    const startTime = eventProject.startsAt
      ? new Date(eventProject.startsAt)
      : new Date()
    const endTime = eventProject.endsAt
      ? new Date(eventProject.endsAt)
      : new Date(startTime.getTime() + 2 * 60 * 60 * 1000) // default 2 hour event

    const googleEventBody = {
      summary: eventProject.title,
      description: eventProject.description || undefined,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
    }

    // Check if we already have a Google event ID stored
    const existingMeta = (cred.config as Record<string, unknown> | null) || {}
    const eventMeta = existingMeta.events as Record<string, string> | undefined
    const existingGoogleEventId = eventMeta?.[eventProject.id]

    let result: { id?: string | null; htmlLink?: string | null }

    if (existingGoogleEventId) {
      // Update existing event
      const updateRes = await calendar.events.update({
        calendarId: 'primary',
        eventId: existingGoogleEventId,
        requestBody: googleEventBody,
      })
      result = updateRes.data
    } else {
      // Create new event
      const createRes = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEventBody,
      })
      result = createRes.data

      // Store the Google event ID in credential metadata
      const updatedEvents = { ...(eventMeta || {}), [eventProject.id]: result.id || '' }
      await rawPrisma.integrationCredential.update({
        where: { id: cred.id },
        data: {
          config: { ...existingMeta, events: updatedEvents },
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }

    // Log the sync
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'google_calendar',
        action: 'push_event',
        status: 'success',
        recordsProcessed: 1,
        recordsFailed: 0,
        metadata: { eventProjectId: eventProject.id, googleEventId: result.id },
      },
    })

    return {
      googleEventId: result.id || '',
      htmlLink: result.htmlLink || undefined,
    }
  } catch (error) {
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'google_calendar',
        action: 'push_event',
        status: 'failed',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { eventProjectId: eventProject.id },
      },
    })
    return null
  }
}

// ─── Pull (inbound) sync: fetch user's Google events → ExternalCalendarEvent ──

/**
 * Default window for inbound sync: 7 days back, 90 days forward. Covers the
 * user's immediate schedule so conflict checks are accurate, without pulling
 * years of history we'd never reference.
 */
const INBOUND_PAST_DAYS = 7
const INBOUND_FUTURE_DAYS = 90

/**
 * Pulls events from the user's primary Google Calendar into the
 * ExternalCalendarEvent table. Idempotent — upserts by (userId, provider,
 * externalId). Cancelled events from Google are soft-deleted locally so
 * conflict checks ignore them.
 *
 * Returns { imported, deleted, error? } with counts so the caller can
 * surface feedback in the UI.
 */
export async function importEventsFromGoogleCalendar(
  userId: string,
  organizationId: string
): Promise<{ imported: number; deleted: number; error?: string }> {
  if (!isAvailable()) {
    return { imported: 0, deleted: 0, error: 'Google Calendar credentials not configured' }
  }

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, userId, provider: 'google_calendar', isActive: true },
  })
  if (!cred) {
    return { imported: 0, deleted: 0, error: 'No active Google Calendar connection for this user' }
  }

  try {
    const oauth2Client = await refreshTokenIfNeeded(cred.id)
    if (!oauth2Client) {
      return { imported: 0, deleted: 0, error: 'Failed to refresh Google Calendar token' }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const now = new Date()
    const timeMin = new Date(now.getTime() - INBOUND_PAST_DAYS * 24 * 60 * 60 * 1000)
    const timeMax = new Date(now.getTime() + INBOUND_FUTURE_DAYS * 24 * 60 * 60 * 1000)

    // Paginate events.list — recurring events are expanded via singleEvents=true
    // so we store concrete instances, which is what conflict checks need.
    let pageToken: string | undefined = undefined
    const allItems: calendar_v3.Schema$Event[] = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res: { data: calendar_v3.Schema$Events } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        showDeleted: true,
        pageToken,
      })
      if (res.data.items) allItems.push(...res.data.items)
      if (!res.data.nextPageToken) break
      pageToken = res.data.nextPageToken
    }

    const primaryCalendarName = 'primary'
    let imported = 0
    let deleted = 0

    for (const item of allItems) {
      const externalId = item.id
      if (!externalId) continue

      // Cancelled events — soft-delete the local row
      if (item.status === 'cancelled') {
        const hit = await rawPrisma.externalCalendarEvent.updateMany({
          where: { userId, provider: 'google_calendar', externalId },
          data: { deletedAt: new Date(), status: 'cancelled', lastSyncedAt: new Date() },
        })
        if (hit.count > 0) deleted += hit.count
        continue
      }

      const { startsAt, endsAt, isAllDay } = normalizeGoogleTime(item.start, item.end)
      if (!startsAt || !endsAt) continue

      await rawPrisma.externalCalendarEvent.upsert({
        where: {
          userId_provider_externalId: { userId, provider: 'google_calendar', externalId },
        },
        create: {
          organizationId,
          userId,
          provider: 'google_calendar',
          externalId,
          sourceCalendarId: 'primary',
          sourceCalendarName: primaryCalendarName,
          title: item.summary ?? '(No title)',
          description: item.description ?? null,
          location: item.location ?? null,
          url: item.htmlLink ?? null,
          startsAt,
          endsAt,
          isAllDay,
          status: item.status ?? 'confirmed',
          timeZone: item.start?.timeZone ?? item.end?.timeZone ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          title: item.summary ?? '(No title)',
          description: item.description ?? null,
          location: item.location ?? null,
          url: item.htmlLink ?? null,
          startsAt,
          endsAt,
          isAllDay,
          status: item.status ?? 'confirmed',
          timeZone: item.start?.timeZone ?? item.end?.timeZone ?? null,
          lastSyncedAt: new Date(),
          deletedAt: null, // resurrect if previously tombstoned
          updatedAt: new Date(),
        },
      })
      imported++
    }

    // Mark the credential's last-sync timestamp for UI display
    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: { lastSyncAt: new Date(), updatedAt: new Date() },
    })

    // Audit log
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'google_calendar',
        action: 'pull_events',
        status: 'success',
        recordsProcessed: imported,
        recordsFailed: 0,
        metadata: { imported, deleted, windowDays: INBOUND_PAST_DAYS + INBOUND_FUTURE_DAYS },
      },
    })

    return { imported, deleted }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during Google Calendar import'
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'google_calendar',
        action: 'pull_events',
        status: 'failed',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: message,
      },
    })
    return { imported: 0, deleted: 0, error: message }
  }
}

/**
 * Normalizes a Google event's `start` / `end` fields into Date objects and
 * an all-day flag. Google returns either `dateTime` (timed) or `date` (all-day),
 * never both. All-day end dates are exclusive — Google says end=2026-05-01
 * means the event runs through Apr 30 inclusive.
 */
function normalizeGoogleTime(
  start: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null | undefined,
  end: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null | undefined,
): { startsAt: Date | null; endsAt: Date | null; isAllDay: boolean } {
  if (!start || !end) return { startsAt: null, endsAt: null, isAllDay: false }

  if (start.dateTime && end.dateTime) {
    return { startsAt: new Date(start.dateTime), endsAt: new Date(end.dateTime), isAllDay: false }
  }

  if (start.date && end.date) {
    // All-day event — treat end as exclusive per the iCal/Google convention
    const startsAt = new Date(`${start.date}T00:00:00`)
    const endsAt = new Date(`${end.date}T00:00:00`)
    return { startsAt, endsAt, isAllDay: true }
  }

  return { startsAt: null, endsAt: null, isAllDay: false }
}

// ─── Remove event from calendar ──────────────────────────────────────────────

/**
 * Deletes a Google Calendar event by its Google event ID.
 */
export async function removeEventFromCalendar(
  userId: string,
  organizationId: string,
  googleEventId: string
): Promise<boolean> {
  if (!isAvailable()) return false

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, userId, provider: 'google_calendar', isActive: true },
  })

  if (!cred) return false

  try {
    const oauth2Client = await refreshTokenIfNeeded(cred.id)
    if (!oauth2Client) return false

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    })

    return true
  } catch {
    return false
  }
}

// ─── Remove event from all users' calendars ─────────────────────────────────

/**
 * Removes a Google Calendar event for a given EventProject from ALL users
 * who have synced it. Used when an event is deleted or cancelled.
 *
 * Looks up every active google_calendar credential in the org, checks if
 * it has a stored Google event ID for this project, and deletes it.
 */
export async function removeEventProjectFromCalendars(
  organizationId: string,
  eventProjectId: string
): Promise<{ removed: number; failed: number }> {
  if (!isAvailable()) return { removed: 0, failed: 0 }

  const credentials = await rawPrisma.integrationCredential.findMany({
    where: { organizationId, provider: 'google_calendar', isActive: true },
  })

  let removed = 0
  let failed = 0

  for (const cred of credentials) {
    const meta = (cred.config as Record<string, unknown> | null) || {}
    const eventMeta = meta.events as Record<string, string> | undefined
    const googleEventId = eventMeta?.[eventProjectId]

    if (!googleEventId) continue

    try {
      const oauth2Client = await refreshTokenIfNeeded(cred.id)
      if (!oauth2Client) {
        failed++
        continue
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      })

      // Remove the event ID from credential metadata
      const { [eventProjectId]: _removed, ...remainingEvents } = eventMeta!
      await rawPrisma.integrationCredential.update({
        where: { id: cred.id },
        data: {
          config: { ...meta, events: remainingEvents },
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
      })

      removed++
    } catch {
      failed++
    }
  }

  // Log the bulk removal
  if (removed > 0 || failed > 0) {
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: credentials[0]?.id ?? 'unknown',
        provider: 'google_calendar',
        action: 'remove_event',
        status: failed > 0 ? 'partial' : 'success',
        recordsProcessed: removed,
        recordsFailed: failed,
        metadata: { eventProjectId },
      },
    })
  }

  return { removed, failed }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(userId: string, organizationId: string): Promise<void> {
  await rawPrisma.integrationCredential.updateMany({
    where: { userId, organizationId, provider: 'google_calendar' },
    data: { isActive: false, updatedAt: new Date() },
  })
}
