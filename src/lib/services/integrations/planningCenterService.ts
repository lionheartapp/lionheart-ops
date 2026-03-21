/**
 * Planning Center Online (PCO) Integration Service
 *
 * Handles OAuth authorization, people sync, services sync, and check-in push.
 * All functions gracefully return null/empty if PCO_APP_ID and PCO_SECRET are not set.
 */

import { rawPrisma } from '@/lib/db'
import type { PCOSyncResult } from '@/lib/types/integrations'

const PCO_BASE_URL = 'https://api.planningcenteronline.com'
const PCO_AUTH_URL = 'https://api.planningcenteronline.com/oauth/authorize'
const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token'

// ─── Availability check ──────────────────────────────────────────────────────

export function isAvailable(): boolean {
  return !!(process.env.PCO_APP_ID && process.env.PCO_SECRET)
}

// ─── OAuth helpers ───────────────────────────────────────────────────────────

/**
 * Returns the PCO OAuth authorization URL for an org-level connection.
 * Returns null if PCO credentials are not configured.
 */
export function getAuthUrl(organizationId: string): string | null {
  if (!isAvailable()) return null

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.PCO_APP_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/api/integrations/planning-center/callback`,
    scope: 'people services check_ins',
    state: organizationId,
  })

  return `${PCO_AUTH_URL}?${params.toString()}`
}

/**
 * Exchanges an OAuth code for tokens and stores them in IntegrationCredential.
 */
export async function handleCallback(
  organizationId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!isAvailable()) {
    return { success: false, error: 'Planning Center credentials not configured' }
  }

  try {
    const response = await fetch(PCO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.PCO_APP_ID,
        client_secret: process.env.PCO_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/api/integrations/planning-center/callback`,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Token exchange failed: ${error}` }
    }

    const tokenData = await response.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000)

    // Fetch org name from PCO
    let orgName: string | null = null
    try {
      const meRes = await fetch(`${PCO_BASE_URL}/people/v2/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (meRes.ok) {
        const meData = await meRes.json()
        orgName = meData.data?.relationships?.organization?.data?.id || null
      }
    } catch {
      // Non-fatal
    }

    // Prisma can't use null in compound unique where, so use findFirst + create/update
    const existing = await rawPrisma.integrationCredential.findFirst({
      where: { organizationId, provider: 'planning_center', userId: null },
    })

    if (existing) {
      await rawPrisma.integrationCredential.update({
        where: { id: existing.id },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiresAt: expiresAt,
          config: { orgName },
          isActive: true,
          updatedAt: new Date(),
        },
      })
    } else {
      await rawPrisma.integrationCredential.create({
        data: {
          organizationId,
          provider: 'planning_center',
          userId: null,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiresAt: expiresAt,
          config: { orgName },
          isActive: true,
        },
      })
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during callback',
    }
  }
}

// ─── Token refresh ───────────────────────────────────────────────────────────

async function getValidAccessToken(organizationId: string): Promise<string | null> {
  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'planning_center', isActive: true },
  })

  if (!cred || !cred.accessToken) return null

  // If token expires within 5 minutes, refresh it
  const needsRefresh =
    cred.tokenExpiresAt && cred.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return cred.accessToken

  if (!cred.refreshToken) return null

  try {
    const response = await fetch(PCO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: cred.refreshToken,
        client_id: process.env.PCO_APP_ID,
        client_secret: process.env.PCO_SECRET,
      }),
    })

    if (!response.ok) return cred.accessToken // Return old token as fallback

    const tokenData = await response.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000)

    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || cred.refreshToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    })

    return tokenData.access_token
  } catch {
    return cred.accessToken // Fallback to old token
  }
}

// ─── People sync ─────────────────────────────────────────────────────────────

/**
 * Fetches people from PCO and matches them to Lionheart users by email.
 * Updates name/phone for matched users. Logs unmatched for review.
 */
export async function syncPeople(organizationId: string): Promise<PCOSyncResult> {
  if (!isAvailable()) return { matched: 0, unmatched: 0, errors: 0 }

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'planning_center', isActive: true },
  })

  if (!cred) return { matched: 0, unmatched: 0, errors: 1, details: ['Not connected to Planning Center'] }

  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) return { matched: 0, unmatched: 0, errors: 1, details: ['Invalid access token'] }

  const result: PCOSyncResult = { matched: 0, unmatched: 0, errors: 0, details: [] }

  try {
    let nextUrl: string | null = `${PCO_BASE_URL}/people/v2/people?per_page=100&include=emails,phone_numbers`

    while (nextUrl) {
      const fetchResponse = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!fetchResponse.ok) {
        result.errors++
        result.details?.push(`PCO API error: ${fetchResponse.status}`)
        break
      }

      const data: {
        data: Array<{
          attributes: Record<string, string>
          relationships: { emails?: { data: Array<{ id: string }> } }
        }>
        included?: Array<{ type: string; id: string; attributes: Record<string, string> }>
        links?: { next?: string }
      } = await fetchResponse.json()
      const people = data.data || []

      for (const person of people) {
        const attrs = person.attributes || {}
        const firstName = attrs.first_name || ''
        const lastName = attrs.last_name || ''
        const phone = attrs.demographic_avatar_url || null

        // Find primary email from included
        const emailRel = person.relationships?.emails?.data || []
        const emailObj = (data.included || []).find(
          (inc: { type: string; id: string }) =>
            inc.type === 'Email' && emailRel.some((r: { id: string }) => r.id === inc.id)
        )
        const email = emailObj?.attributes?.address?.toLowerCase() || null

        if (!email) {
          result.unmatched++
          continue
        }

        // Find matching Lionheart user
        const user = await rawPrisma.user.findFirst({
          where: { organizationId, email, deletedAt: null },
        })

        if (user) {
          await rawPrisma.user.update({
            where: { id: user.id },
            data: {
              firstName: user.firstName || firstName || undefined,
              lastName: user.lastName || lastName || undefined,
              phone: user.phone || phone || undefined,
              updatedAt: new Date(),
            },
          })
          result.matched++
        } else {
          result.unmatched++
          result.details?.push(`No match for PCO person: ${firstName} ${lastName} <${email}>`)
        }
      }

      nextUrl = data.links?.next || null
    }

    // Create sync log
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'sync_people',
        status: result.errors > 0 ? 'partial' : 'success',
        recordsProcessed: result.matched + result.unmatched,
        recordsFailed: result.errors,
        metadata: { matched: result.matched, unmatched: result.unmatched },
      },
    })

    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: { lastSyncAt: new Date() },
    })
  } catch (error) {
    result.errors++
    result.details?.push(error instanceof Error ? error.message : 'Unknown error')

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'sync_people',
        status: 'failed',
        recordsProcessed: result.matched,
        recordsFailed: result.errors,
        errorMessage: result.details?.join('; '),
      },
    })
  }

  return result
}

// ─── Services sync ───────────────────────────────────────────────────────────

/**
 * Fetches service types and plans from PCO Services API.
 * Logs results for review — does not auto-create EventProjects.
 */
export async function syncServices(organizationId: string): Promise<PCOSyncResult> {
  if (!isAvailable()) return { matched: 0, unmatched: 0, errors: 0 }

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'planning_center', isActive: true },
  })

  if (!cred) return { matched: 0, unmatched: 0, errors: 1, details: ['Not connected'] }

  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) return { matched: 0, unmatched: 0, errors: 1, details: ['Invalid access token'] }

  const result: PCOSyncResult = { matched: 0, unmatched: 0, errors: 0, details: [] }

  try {
    const response = await fetch(`${PCO_BASE_URL}/services/v2/service_types?per_page=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      result.errors++
      result.details?.push(`PCO Services API error: ${response.status}`)
    } else {
      const data = await response.json()
      const serviceTypes = data.data || []

      for (const serviceType of serviceTypes) {
        const name = serviceType.attributes?.name || 'Unknown'
        result.matched++
        result.details?.push(`Service type found: ${name}`)
      }
    }

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'sync_services',
        status: result.errors > 0 ? 'partial' : 'success',
        recordsProcessed: result.matched,
        recordsFailed: result.errors,
        metadata: { serviceTypes: result.matched },
      },
    })

    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: { lastSyncAt: new Date() },
    })
  } catch (error) {
    result.errors++
    result.details?.push(error instanceof Error ? error.message : 'Unknown error')

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'sync_services',
        status: 'failed',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: result.details?.join('; '),
      },
    })
  }

  return result
}

// ─── Check-in push ───────────────────────────────────────────────────────────

/**
 * Pushes EventCheckIn records to PCO Check-ins API.
 * One-way push — Lionheart → PCO.
 */
export async function pushCheckIns(
  organizationId: string,
  eventProjectId: string
): Promise<PCOSyncResult> {
  if (!isAvailable()) return { matched: 0, unmatched: 0, errors: 0 }

  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'planning_center', isActive: true },
  })

  if (!cred) return { matched: 0, unmatched: 0, errors: 1, details: ['Not connected'] }

  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) return { matched: 0, unmatched: 0, errors: 1, details: ['Invalid access token'] }

  const result: PCOSyncResult = { matched: 0, unmatched: 0, errors: 0, details: [] }

  try {
    // Fetch check-ins for this event project
    const checkIns = await rawPrisma.eventCheckIn.findMany({
      where: { eventProjectId, organizationId },
      include: { registration: true },
    })

    for (const checkIn of checkIns) {
      try {
        const firstName = checkIn.registration?.firstName || 'Participant'
        const lastName = checkIn.registration?.lastName || ''
        // Note: PCO Check-ins API requires a headcount or person ID
        // We push the check-in as a named attendee event
        const response = await fetch(`${PCO_BASE_URL}/check_ins/v2/check_ins`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              type: 'CheckIn',
              attributes: {
                first_name: firstName,
                last_name: lastName,
                checked_in_at: checkIn.checkedInAt?.toISOString(),
              },
            },
          }),
        })

        if (response.ok) {
          result.matched++
        } else {
          result.unmatched++
          const name = `${checkIn.registration?.firstName || ''} ${checkIn.registration?.lastName || ''}`.trim()
          result.details?.push(`Failed to push check-in for ${name || checkIn.registrationId}`)
        }
      } catch {
        result.errors++
      }
    }

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'push_checkins',
        status: result.errors > 0 ? 'partial' : 'success',
        recordsProcessed: result.matched + result.unmatched,
        recordsFailed: result.errors,
        metadata: { eventProjectId, pushed: result.matched },
      },
    })
  } catch (error) {
    result.errors++
    result.details?.push(error instanceof Error ? error.message : 'Unknown error')

    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'push_checkins',
        status: 'failed',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: result.details?.join('; '),
      },
    })
  }

  return result
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(organizationId: string): Promise<void> {
  await rawPrisma.integrationCredential.updateMany({
    where: { organizationId, provider: 'planning_center' },
    data: { isActive: false, updatedAt: new Date() },
  })
}
