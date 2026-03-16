/**
 * Google Calendar Integration Service
 *
 * Handles per-user OAuth authorization and event push/removal.
 * Uses googleapis npm package for the Calendar API v3 client.
 * All functions gracefully return null if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.
 */

import { google } from 'googleapis'
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

function createOAuth2Client() {
  const redirectUri = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/api/integrations/google-calendar/callback`
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

// ─── Auth URL ────────────────────────────────────────────────────────────────

/**
 * Returns the Google OAuth authorization URL for a per-user calendar connection.
 * Returns null if Google credentials are not configured.
 */
export function getAuthUrl(userId: string): string | null {
  if (!isAvailable()) return null

  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state: userId,
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

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(userId: string, organizationId: string): Promise<void> {
  await rawPrisma.integrationCredential.updateMany({
    where: { userId, organizationId, provider: 'google_calendar' },
    data: { isActive: false, updatedAt: new Date() },
  })
}
