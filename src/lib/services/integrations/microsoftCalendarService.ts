/**
 * Microsoft Calendar Integration Service
 *
 * Per-user OAuth2 flow using Microsoft identity platform (Entra ID).
 * Fetches events from Microsoft Graph API v1.0 — no SDK dependency,
 * all HTTP via native fetch.
 *
 * Reuses the same AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET env vars
 * that the SSO auth uses, but requests Calendars.Read scope for calendar
 * access. The user's Azure app registration must include the redirect URI:
 *   {APP_URL}/api/integrations/microsoft-calendar/callback
 *
 * Token storage follows the exact same IntegrationCredential pattern as
 * Google Calendar, with provider = "microsoft_calendar".
 */

import { rawPrisma } from '@/lib/db'

const MS_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const SCOPES = 'Calendars.Read offline_access User.Read'
const PROVIDER = 'microsoft_calendar'
const INBOUND_PAST_DAYS = 7
const INBOUND_FUTURE_DAYS = 90

// ─── Availability check ──────────────────────────────────────────────────────

export function isAvailable(): boolean {
  return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET)
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  return `${base}/api/integrations/microsoft-calendar/callback`
}

// ─── Auth URL ────────────────────────────────────────────────────────────────

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
    return { userId: state, origin: '' }
  }
}

export function getAuthUrl(userId: string, tenantOrigin?: string): string | null {
  if (!isAvailable()) return null
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    response_mode: 'query',
    prompt: 'consent',
    state: encodeOAuthState(userId, tenantOrigin),
  })
  return `${MS_AUTH_BASE}/authorize?${params}`
}

// ─── Callback handler ────────────────────────────────────────────────────────

export async function handleCallback(
  userId: string,
  organizationId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isAvailable()) {
    return { success: false, error: 'Microsoft Calendar credentials not configured' }
  }

  try {
    const tokenRes = await fetch(`${MS_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        code,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
        scope: SCOPES,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return { success: false, error: `Token exchange failed: ${err}` }
    }

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return { success: false, error: 'No access token received from Microsoft' }
    }

    // Fetch user email for display
    let msEmail: string | null = null
    try {
      const meRes = await fetch(`${GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        msEmail = me.mail || me.userPrincipalName || null
      }
    } catch { /* non-fatal */ }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000)

    await rawPrisma.integrationCredential.upsert({
      where: {
        organizationId_provider_userId: { organizationId, provider: PROVIDER, userId },
      },
      create: {
        organizationId,
        userId,
        provider: PROVIDER,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: expiresAt,
        config: { msEmail },
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        config: { msEmail },
        isActive: true,
        updatedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Microsoft Calendar callback',
    }
  }
}

// ─── Token refresh ───────────────────────────────────────────────────────────

async function refreshTokenIfNeeded(credentialId: string): Promise<string | null> {
  const cred = await rawPrisma.integrationCredential.findUnique({ where: { id: credentialId } })
  if (!cred || !cred.accessToken) return null

  const needsRefresh = cred.tokenExpiresAt && cred.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return cred.accessToken

  if (!cred.refreshToken) return cred.accessToken

  try {
    const res = await fetch(`${MS_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        refresh_token: cred.refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES,
      }),
    })

    if (!res.ok) return cred.accessToken

    const data = await res.json()
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)

    await rawPrisma.integrationCredential.update({
      where: { id: credentialId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cred.refreshToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    })

    return data.access_token
  } catch {
    return cred.accessToken
  }
}

// ─── Pull (inbound) sync ─────────────────────────────────────────────────────

interface MSGraphEvent {
  id: string
  subject?: string
  bodyPreview?: string
  start?: { dateTime?: string; timeZone?: string; date?: string }
  end?: { dateTime?: string; timeZone?: string; date?: string }
  isAllDay?: boolean
  location?: { displayName?: string }
  webLink?: string
  isCancelled?: boolean
  showAs?: string
}

export async function importEventsFromMicrosoftCalendar(
  userId: string,
  organizationId: string
): Promise<{ imported: number; deleted: number; error?: string }> {
  if (!isAvailable()) {
    return { imported: 0, deleted: 0, error: 'Microsoft Calendar credentials not configured' }
  }

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, userId, provider: PROVIDER, isActive: true },
  })
  if (!cred) {
    return { imported: 0, deleted: 0, error: 'No active Microsoft Calendar connection for this user' }
  }

  try {
    const accessToken = await refreshTokenIfNeeded(cred.id)
    if (!accessToken) {
      return { imported: 0, deleted: 0, error: 'Failed to refresh Microsoft token' }
    }

    const now = new Date()
    const startDateTime = new Date(now.getTime() - INBOUND_PAST_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const endDateTime = new Date(now.getTime() + INBOUND_FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Microsoft Graph calendarView returns expanded recurring instances
    const allEvents: MSGraphEvent[] = []
    let nextLink: string | undefined = `${GRAPH_BASE}/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=500&$select=id,subject,bodyPreview,start,end,isAllDay,location,webLink,isCancelled,showAs`

    while (nextLink) {
      const res: Response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const errText = await res.text()
        return { imported: 0, deleted: 0, error: `Microsoft Graph error: ${errText}` }
      }
      const data: { value?: MSGraphEvent[]; '@odata.nextLink'?: string } = await res.json()
      if (data.value) allEvents.push(...data.value)
      nextLink = data['@odata.nextLink'] ?? undefined
    }

    let imported = 0
    let deleted = 0

    for (const item of allEvents) {
      if (!item.id) continue

      if (item.isCancelled) {
        const hit = await rawPrisma.externalCalendarEvent.updateMany({
          where: { userId, provider: PROVIDER, externalId: item.id },
          data: { deletedAt: new Date(), status: 'cancelled', lastSyncedAt: new Date() },
        })
        if (hit.count > 0) deleted += hit.count
        continue
      }

      const { startsAt, endsAt, isAllDay } = normalizeMSTime(item.start, item.end, item.isAllDay)
      if (!startsAt || !endsAt) continue

      await rawPrisma.externalCalendarEvent.upsert({
        where: {
          userId_provider_externalId: { userId, provider: PROVIDER, externalId: item.id },
        },
        create: {
          organizationId,
          userId,
          provider: PROVIDER,
          externalId: item.id,
          sourceCalendarId: 'primary',
          sourceCalendarName: 'Outlook Calendar',
          title: item.subject ?? '(No title)',
          description: item.bodyPreview ?? null,
          location: item.location?.displayName ?? null,
          url: item.webLink ?? null,
          startsAt,
          endsAt,
          isAllDay,
          status: 'confirmed',
          timeZone: item.start?.timeZone ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          title: item.subject ?? '(No title)',
          description: item.bodyPreview ?? null,
          location: item.location?.displayName ?? null,
          url: item.webLink ?? null,
          startsAt,
          endsAt,
          isAllDay,
          status: 'confirmed',
          timeZone: item.start?.timeZone ?? null,
          lastSyncedAt: new Date(),
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      imported++
    }

    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: { lastSyncAt: new Date(), updatedAt: new Date() },
    })

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: PROVIDER,
        action: 'pull_events',
        status: 'success',
        recordsProcessed: imported,
        recordsFailed: 0,
        metadata: { imported, deleted },
      },
    })

    return { imported, deleted }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during Microsoft Calendar import'
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: PROVIDER,
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

function normalizeMSTime(
  start: MSGraphEvent['start'],
  end: MSGraphEvent['end'],
  isAllDay?: boolean,
): { startsAt: Date | null; endsAt: Date | null; isAllDay: boolean } {
  if (!start?.dateTime || !end?.dateTime) return { startsAt: null, endsAt: null, isAllDay: false }

  // Microsoft always sends dateTime — the field is present even for all-day
  // events. For all-day events the dateTime is "2026-04-16T00:00:00.0000000".
  const startsAt = new Date(start.dateTime + (start.timeZone ? '' : 'Z'))
  const endsAt = new Date(end.dateTime + (end.timeZone ? '' : 'Z'))

  return { startsAt, endsAt, isAllDay: isAllDay ?? false }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(userId: string, organizationId: string): Promise<void> {
  await rawPrisma.integrationCredential.updateMany({
    where: { userId, organizationId, provider: PROVIDER },
    data: { isActive: false, updatedAt: new Date() },
  })
}
