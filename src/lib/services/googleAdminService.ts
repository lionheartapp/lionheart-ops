/**
 * Google Admin SDK Service
 *
 * Handles Chromebook device sync from Google Workspace Admin Console:
 * - Service account JWT authentication (RS256, no external dependencies)
 * - Chromebook listing and single-device fetch via Admin Directory API
 * - Full sync: paginate all Chromebooks, match to ITDevice by serial/assetTag
 * - Connection testing for setup wizard
 */

import crypto from 'crypto'
import { rawPrisma, prisma } from '@/lib/db'
import { generateAssetTag } from '@/lib/services/itDeviceService'
import * as syncJobService from '@/lib/services/itSyncJobService'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GoogleChromebook {
  deviceId: string
  serialNumber: string
  model: string
  status: string // ACTIVE, DISABLED, DEPROVISIONED
  osVersion: string
  annotatedAssetId?: string // Asset tag set by admin
  annotatedUser?: string
  orgUnitPath: string
  lastSync: string
  macAddress?: string
  manufactureDate?: string
  recentUsers?: { email: string; type: string }[]
}

interface GoogleChromebookListResponse {
  chromeosdevices?: GoogleChromebook[]
  nextPageToken?: string
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

interface SyncSummary {
  jobId: string
  status: string
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  errors: string[]
}

// ─── JWT Signing (Node.js crypto, no external deps) ─────────────────────────

function createServiceAccountJWT(
  key: ServiceAccountKey,
  adminEmail: string,
  scope: string
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url')

  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      sub: adminEmail,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url')

  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${payload}`),
    key.private_key
  )

  return `${header}.${payload}.${signature.toString('base64url')}`
}

// ─── Get Access Token ───────────────────────────────────────────────────────

export async function getAccessToken(
  serviceAccountKey: string,
  adminEmail: string
): Promise<string> {
  const key: ServiceAccountKey = JSON.parse(serviceAccountKey)

  if (!key.client_email || !key.private_key) {
    throw new Error('INVALID_SERVICE_ACCOUNT: Missing client_email or private_key in service account key')
  }

  const jwt = createServiceAccountJWT(
    key,
    adminEmail,
    'https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly'
  )

  const tokenUrl = key.token_uri || 'https://oauth2.googleapis.com/token'

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`GOOGLE_AUTH_FAILED: Token exchange failed (${res.status}): ${errorBody}`)
  }

  const data = await res.json()

  if (!data.access_token) {
    throw new Error('GOOGLE_AUTH_FAILED: No access_token in response')
  }

  return data.access_token
}

// ─── List Chromebooks ───────────────────────────────────────────────────────

export async function listChromebooks(
  accessToken: string,
  pageToken?: string
): Promise<{ devices: GoogleChromebook[]; nextPageToken?: string }> {
  const url = new URL(
    'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/devices/chromeos'
  )
  url.searchParams.set('maxResults', '100')
  url.searchParams.set('projection', 'FULL')
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`GOOGLE_API_ERROR: Failed to list chromebooks (${res.status}): ${errorBody}`)
  }

  const data: GoogleChromebookListResponse = await res.json()

  // Rate limit: simple delay between paginated requests
  await new Promise((resolve) => setTimeout(resolve, 100))

  return {
    devices: data.chromeosdevices || [],
    nextPageToken: data.nextPageToken,
  }
}

// ─── Get Single Chromebook ──────────────────────────────────────────────────

export async function getChromebook(
  accessToken: string,
  deviceId: string
): Promise<GoogleChromebook> {
  const url = `https://admin.googleapis.com/admin/directory/v1/customer/my_customer/devices/chromeos/${encodeURIComponent(deviceId)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`GOOGLE_API_ERROR: Failed to get chromebook ${deviceId} (${res.status}): ${errorBody}`)
  }

  return res.json()
}

// ─── Map Google Status to Internal Enrollment Status ────────────────────────

function mapEnrollmentStatus(googleStatus: string): string {
  switch (googleStatus) {
    case 'ACTIVE':
      return 'ENROLLED'
    case 'DISABLED':
      return 'DISABLED'
    case 'DEPROVISIONED':
      return 'NOT_ENROLLED'
    default:
      return 'PENDING'
  }
}

// ─── Sync Chromebooks ───────────────────────────────────────────────────────

export async function syncChromebooks(orgId: string): Promise<SyncSummary> {
  // Get sync config for google_admin provider
  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'google_admin' },
  })

  if (!config) {
    throw new Error('SYNC_NOT_CONFIGURED: No Google Admin sync configuration found')
  }

  if (!config.isEnabled) {
    throw new Error('SYNC_DISABLED: Google Admin sync is disabled')
  }

  if (!config.credentials) {
    throw new Error('SYNC_NO_CREDENTIALS: Google Admin sync has no credentials configured')
  }

  const credentials = config.credentials as { serviceAccountKey: string; adminEmail: string }

  if (!credentials.serviceAccountKey || !credentials.adminEmail) {
    throw new Error('SYNC_INVALID_CREDENTIALS: Missing serviceAccountKey or adminEmail')
  }

  // Create sync job
  const job = await syncJobService.createJob(config.id, 'google_admin', 'device_sync')
  await syncJobService.startJob(job.id)

  const errors: string[] = []
  let recordsCreated = 0
  let recordsUpdated = 0
  let recordsSkipped = 0

  try {
    // Get access token
    const accessToken = await getAccessToken(
      typeof credentials.serviceAccountKey === 'string'
        ? credentials.serviceAccountKey
        : JSON.stringify(credentials.serviceAccountKey),
      credentials.adminEmail
    )

    // Paginate through all chromebooks
    let pageToken: string | undefined
    do {
      const page = await listChromebooks(accessToken, pageToken)

      for (const chromebook of page.devices) {
        try {
          if (!chromebook.serialNumber) {
            recordsSkipped++
            continue
          }

          // Try to find existing device by serial number
          let existingDevice = await prisma.iTDevice.findFirst({
            where: { serialNumber: chromebook.serialNumber },
          })

          // Fallback: try to match by annotatedAssetId (asset tag)
          if (!existingDevice && chromebook.annotatedAssetId) {
            existingDevice = await prisma.iTDevice.findFirst({
              where: { assetTag: chromebook.annotatedAssetId },
            })
          }

          if (existingDevice) {
            // Update existing device with Google data
            await prisma.iTDevice.update({
              where: { id: existingDevice.id },
              data: {
                osVersion: chromebook.osVersion || existingDevice.osVersion,
                enrollmentStatus: mapEnrollmentStatus(chromebook.status) as 'ENROLLED' | 'NOT_ENROLLED' | 'PENDING' | 'DISABLED',
                googleDeviceId: chromebook.deviceId,
                model: chromebook.model || existingDevice.model,
              },
            })
            recordsUpdated++
          } else {
            // Create new device
            const assetTag = await generateAssetTag(orgId)

            await (prisma.iTDevice.create as Function)({
              data: {
                assetTag,
                serialNumber: chromebook.serialNumber,
                deviceType: 'CHROMEBOOK',
                make: extractManufacturer(chromebook.model),
                model: chromebook.model || null,
                osVersion: chromebook.osVersion || null,
                status: chromebook.status === 'ACTIVE' ? 'ACTIVE' : 'RETIRED',
                enrollmentStatus: mapEnrollmentStatus(chromebook.status),
                googleDeviceId: chromebook.deviceId,
              },
            })
            recordsCreated++
          }
        } catch (deviceError) {
          const msg = deviceError instanceof Error ? deviceError.message : 'Unknown error'
          errors.push(`Device ${chromebook.serialNumber || chromebook.deviceId}: ${msg}`)
          recordsSkipped++
        }
      }

      pageToken = page.nextPageToken
    } while (pageToken)

    // Complete the job
    await syncJobService.completeJob(job.id, {
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
    })

    // Update sync config with last sync info
    await prisma.iTSyncConfig.update({
      where: { id: config.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
      },
    })

    return {
      jobId: job.id,
      status: 'COMPLETED',
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      errors,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    errors.push(errorMessage)

    await syncJobService.failJob(job.id, errors)

    // Update sync config with error info
    try {
      await prisma.iTSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'error',
          lastSyncError: errorMessage,
        },
      })
    } catch {
      // Swallow config update failure — the job itself is already marked failed
    }

    return {
      jobId: job.id,
      status: 'FAILED',
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      errors,
    }
  }
}

// ─── Test Connection ────────────────────────────────────────────────────────

export async function testConnection(
  orgId: string
): Promise<{ success: boolean; message: string; deviceCount?: number }> {
  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'google_admin' },
  })

  if (!config || !config.credentials) {
    return { success: false, message: 'No Google Admin configuration found' }
  }

  const credentials = config.credentials as { serviceAccountKey: string; adminEmail: string }

  if (!credentials.serviceAccountKey || !credentials.adminEmail) {
    return { success: false, message: 'Missing service account key or admin email' }
  }

  try {
    const accessToken = await getAccessToken(
      typeof credentials.serviceAccountKey === 'string'
        ? credentials.serviceAccountKey
        : JSON.stringify(credentials.serviceAccountKey),
      credentials.adminEmail
    )

    const result = await listChromebooks(accessToken)

    return {
      success: true,
      message: `Connected successfully. Found ${result.devices.length} Chromebooks on first page.`,
      deviceCount: result.devices.length,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Connection failed: ${msg}` }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractManufacturer(model: string | undefined): string | null {
  if (!model) return null

  const lower = model.toLowerCase()
  if (lower.includes('lenovo')) return 'Lenovo'
  if (lower.includes('hp') || lower.includes('hewlett')) return 'HP'
  if (lower.includes('dell')) return 'Dell'
  if (lower.includes('acer')) return 'Acer'
  if (lower.includes('asus')) return 'ASUS'
  if (lower.includes('samsung')) return 'Samsung'
  if (lower.includes('google')) return 'Google'
  if (lower.includes('toshiba')) return 'Toshiba'

  return null
}
