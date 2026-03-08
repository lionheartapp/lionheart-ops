/**
 * Roster Sync Service
 *
 * Syncs student rosters from Clever and ClassLink into the Student model:
 * - OneRoster-compatible data normalization
 * - Clever API v3.1 integration (bearer token auth)
 * - ClassLink OneRoster v1.1 integration (OAuth2 client credentials)
 * - Webhook handlers for real-time student changes
 * - Unified dispatcher for provider-agnostic sync
 */

import { prisma } from '@/lib/db'
import * as syncJobService from '@/lib/services/itSyncJobService'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OneRosterStudent {
  sourcedId: string
  givenName: string
  familyName: string
  email?: string
  grade?: string
  orgs: { sourcedId: string; name: string }[]
  status: 'active' | 'inactive'
}

interface CleverStudentData {
  id: string
  name: { first: string; last: string }
  email?: string
  grade?: string
  school?: string
  schools?: string[]
}

interface CleverResponse {
  data: { id: string; type: string; attributes: CleverStudentData }[]
  links?: { next?: string }
}

interface ClassLinkStudentsResponse {
  users: {
    sourcedId: string
    givenName: string
    familyName: string
    email?: string
    grades?: string[]
    orgs?: { sourcedId: string; name: string }[]
    status: string
  }[]
  nextPageUrl?: string
}

interface NormalizedStudent {
  firstName: string
  lastName: string
  email: string | null
  grade: string | null
  gradeNumeric: number | null
  externalId: string
  schoolId: string | null
}

interface SyncSummary {
  jobId: string
  status: string
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  errors: string[]
}

// ─── Grade Normalization ────────────────────────────────────────────────────

function parseGradeNumeric(grade: string | undefined | null): number | null {
  if (!grade) return null

  const lower = grade.toLowerCase().trim()
  if (lower === 'k' || lower === 'kindergarten' || lower === 'kg') return 0
  if (lower === 'pk' || lower === 'pre-k' || lower === 'prek') return -1

  const num = parseInt(lower.replace(/[^0-9]/g, ''), 10)
  if (!isNaN(num) && num >= 0 && num <= 12) return num

  return null
}

function normalizeGradeLabel(grade: string | undefined | null): string | null {
  if (!grade) return null

  const numeric = parseGradeNumeric(grade)
  if (numeric === null) return grade
  if (numeric === -1) return 'Pre-K'
  if (numeric === 0) return 'K'

  const suffix =
    numeric === 1 ? 'st' :
    numeric === 2 ? 'nd' :
    numeric === 3 ? 'rd' : 'th'

  return `${numeric}${suffix}`
}

// ─── Normalize OneRoster Student ────────────────────────────────────────────

export function normalizeToStudent(
  student: OneRosterStudent,
  schoolMappings: Record<string, string>
): NormalizedStudent {
  // Map the first org to an internal school ID via the mapping
  let schoolId: string | null = null
  if (student.orgs && student.orgs.length > 0) {
    const primaryOrg = student.orgs[0]
    schoolId = schoolMappings[primaryOrg.sourcedId] || null
  }

  return {
    firstName: student.givenName,
    lastName: student.familyName,
    email: student.email || null,
    grade: normalizeGradeLabel(student.grade),
    gradeNumeric: parseGradeNumeric(student.grade),
    externalId: student.sourcedId,
    schoolId,
  }
}

// ─── OAuth2 Token Exchange ──────────────────────────────────────────────────

async function getOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`OAUTH_TOKEN_FAILED: Token exchange failed (${res.status}): ${errorBody}`)
  }

  const data = await res.json()

  if (!data.access_token) {
    throw new Error('OAUTH_TOKEN_FAILED: No access_token in response')
  }

  return data.access_token
}

// ─── Upsert Student ────────────────────────────────────────────────────────

async function upsertStudent(
  normalized: NormalizedStudent,
  rosterSource: 'CLEVER' | 'CLASSLINK'
): Promise<'created' | 'updated' | 'skipped'> {
  // Look up by externalId first
  const existing = await prisma.student.findFirst({
    where: { externalId: normalized.externalId },
  })

  if (existing) {
    // Check if anything actually changed
    const hasChanges =
      existing.firstName !== normalized.firstName ||
      existing.lastName !== normalized.lastName ||
      existing.email !== normalized.email ||
      existing.grade !== normalized.grade ||
      existing.gradeNumeric !== normalized.gradeNumeric ||
      existing.schoolId !== normalized.schoolId

    if (!hasChanges) {
      // Touch lastSyncedAt even if no data changed
      await prisma.student.update({
        where: { id: existing.id },
        data: { lastSyncedAt: new Date() },
      })
      return 'skipped'
    }

    await prisma.student.update({
      where: { id: existing.id },
      data: {
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        grade: normalized.grade,
        gradeNumeric: normalized.gradeNumeric,
        schoolId: normalized.schoolId,
        status: 'ACTIVE',
        rosterSource,
        lastSyncedAt: new Date(),
      },
    })

    return 'updated'
  }

  // Create new student
  await (prisma.student.create as Function)({
    data: {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email,
      externalId: normalized.externalId,
      grade: normalized.grade,
      gradeNumeric: normalized.gradeNumeric,
      schoolId: normalized.schoolId,
      status: 'ACTIVE',
      rosterSource,
      lastSyncedAt: new Date(),
    },
  })

  return 'created'
}

// ─── Mark Absent Students Inactive ──────────────────────────────────────────

async function deactivateAbsentStudents(
  syncedExternalIds: Set<string>,
  rosterSource: 'CLEVER' | 'CLASSLINK'
) {
  // Find all students from this provider that were NOT in the sync
  const allProviderStudents = await prisma.student.findMany({
    where: {
      rosterSource,
      status: 'ACTIVE',
    },
    select: { id: true, externalId: true },
  })

  const toDeactivate = allProviderStudents.filter(
    (s: { id: string; externalId: string | null }) =>
      s.externalId && !syncedExternalIds.has(s.externalId)
  )

  if (toDeactivate.length > 0) {
    for (const student of toDeactivate) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          status: 'INACTIVE',
          lastSyncedAt: new Date(),
        },
      })
    }
  }

  return toDeactivate.length
}

// ─── Clever Sync ────────────────────────────────────────────────────────────

export async function cleverSync(orgId: string): Promise<SyncSummary> {
  // Get sync config
  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'clever' },
  })

  if (!config) {
    throw new Error('SYNC_NOT_CONFIGURED: No Clever sync configuration found')
  }

  if (!config.isEnabled) {
    throw new Error('SYNC_DISABLED: Clever sync is disabled')
  }

  if (!config.credentials) {
    throw new Error('SYNC_NO_CREDENTIALS: Clever sync has no credentials configured')
  }

  const credentials = config.credentials as { apiToken: string }

  if (!credentials.apiToken) {
    throw new Error('SYNC_INVALID_CREDENTIALS: Missing Clever API token')
  }

  const schoolMappings = (config.schoolMappings as Record<string, string>) || {}

  // Create sync job
  const job = await syncJobService.createJob(config.id, 'clever', 'roster_sync')
  await syncJobService.startJob(job.id)

  const errors: string[] = []
  let recordsCreated = 0
  let recordsUpdated = 0
  let recordsSkipped = 0
  const syncedExternalIds = new Set<string>()

  try {
    let url: string | null = 'https://api.clever.com/v3.1/students?limit=100'

    while (url) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${credentials.apiToken}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new Error(`CLEVER_API_ERROR: Failed to fetch students (${res.status}): ${errorBody}`)
      }

      const data: CleverResponse = await res.json()

      for (const item of data.data) {
        try {
          const attrs = item.attributes || (item as unknown as { data: CleverStudentData }).data || item

          // Convert Clever format to OneRoster format
          const oneRosterStudent: OneRosterStudent = {
            sourcedId: item.id || attrs.id,
            givenName: attrs.name?.first || '',
            familyName: attrs.name?.last || '',
            email: attrs.email,
            grade: attrs.grade,
            orgs: attrs.schools
              ? attrs.schools.map((s: string) => ({ sourcedId: s, name: '' }))
              : attrs.school
                ? [{ sourcedId: attrs.school, name: '' }]
                : [],
            status: 'active',
          }

          const normalized = normalizeToStudent(oneRosterStudent, schoolMappings)
          syncedExternalIds.add(normalized.externalId)

          const result = await upsertStudent(normalized, 'CLEVER')

          if (result === 'created') recordsCreated++
          else if (result === 'updated') recordsUpdated++
          else recordsSkipped++
        } catch (studentError) {
          const msg = studentError instanceof Error ? studentError.message : 'Unknown error'
          errors.push(`Student ${item.id}: ${msg}`)
          recordsSkipped++
        }
      }

      // Handle pagination
      url = data.links?.next || null
    }

    // Mark students not seen in this sync as inactive
    const deactivated = await deactivateAbsentStudents(syncedExternalIds, 'CLEVER')
    if (deactivated > 0) {
      recordsUpdated += deactivated
    }

    // Complete the job
    await syncJobService.completeJob(job.id, {
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
    })

    // Update sync config
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
      // Swallow config update failure
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

// ─── ClassLink Sync ─────────────────────────────────────────────────────────

export async function classLinkSync(orgId: string): Promise<SyncSummary> {
  // Get sync config
  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'classlink' },
  })

  if (!config) {
    throw new Error('SYNC_NOT_CONFIGURED: No ClassLink sync configuration found')
  }

  if (!config.isEnabled) {
    throw new Error('SYNC_DISABLED: ClassLink sync is disabled')
  }

  if (!config.credentials) {
    throw new Error('SYNC_NO_CREDENTIALS: ClassLink sync has no credentials configured')
  }

  const credentials = config.credentials as {
    clientId: string
    clientSecret: string
    tokenUrl: string
    baseUrl: string
  }

  if (!credentials.clientId || !credentials.clientSecret || !credentials.baseUrl) {
    throw new Error('SYNC_INVALID_CREDENTIALS: Missing clientId, clientSecret, or baseUrl')
  }

  const schoolMappings = (config.schoolMappings as Record<string, string>) || {}

  // Get OAuth token
  const tokenUrl = credentials.tokenUrl || 'https://launchpad.classlink.com/oauth2/v2/token'
  const accessToken = await getOAuthToken(tokenUrl, credentials.clientId, credentials.clientSecret)

  // Create sync job
  const job = await syncJobService.createJob(config.id, 'classlink', 'roster_sync')
  await syncJobService.startJob(job.id)

  const errors: string[] = []
  let recordsCreated = 0
  let recordsUpdated = 0
  let recordsSkipped = 0
  const syncedExternalIds = new Set<string>()

  try {
    const baseUrl = credentials.baseUrl.replace(/\/$/, '')
    let url: string | null = `${baseUrl}/ims/oneroster/v1p1/students?limit=100&offset=0`

    while (url) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new Error(`CLASSLINK_API_ERROR: Failed to fetch students (${res.status}): ${errorBody}`)
      }

      const data: ClassLinkStudentsResponse = await res.json()

      if (!data.users || data.users.length === 0) break

      for (const user of data.users) {
        try {
          // Convert ClassLink OneRoster format to our normalized format
          const oneRosterStudent: OneRosterStudent = {
            sourcedId: user.sourcedId,
            givenName: user.givenName,
            familyName: user.familyName,
            email: user.email,
            grade: user.grades?.[0],
            orgs: user.orgs || [],
            status: user.status === 'active' ? 'active' : 'inactive',
          }

          if (oneRosterStudent.status === 'inactive') {
            recordsSkipped++
            continue
          }

          const normalized = normalizeToStudent(oneRosterStudent, schoolMappings)
          syncedExternalIds.add(normalized.externalId)

          const result = await upsertStudent(normalized, 'CLASSLINK')

          if (result === 'created') recordsCreated++
          else if (result === 'updated') recordsUpdated++
          else recordsSkipped++
        } catch (studentError) {
          const msg = studentError instanceof Error ? studentError.message : 'Unknown error'
          errors.push(`Student ${user.sourcedId}: ${msg}`)
          recordsSkipped++
        }
      }

      // Handle pagination
      url = data.nextPageUrl || null
    }

    // Mark students not seen in this sync as inactive
    const deactivated = await deactivateAbsentStudents(syncedExternalIds, 'CLASSLINK')
    if (deactivated > 0) {
      recordsUpdated += deactivated
    }

    // Complete the job
    await syncJobService.completeJob(job.id, {
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
    })

    // Update sync config
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
      // Swallow config update failure
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

// ─── Clever Webhook Handler ─────────────────────────────────────────────────

export async function handleCleverWebhook(
  payload: Record<string, unknown>,
  orgId: string
): Promise<{ action: string; studentId?: string }> {
  const eventType = payload.type as string
  const eventData = payload.data as Record<string, unknown> | undefined

  if (!eventType || !eventData) {
    throw new Error('INVALID_WEBHOOK: Missing type or data in webhook payload')
  }

  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'clever' },
  })

  const schoolMappings = (config?.schoolMappings as Record<string, string>) || {}

  switch (eventType) {
    case 'student.created':
    case 'student.updated': {
      const studentData = eventData as unknown as CleverStudentData

      const oneRosterStudent: OneRosterStudent = {
        sourcedId: studentData.id,
        givenName: studentData.name?.first || '',
        familyName: studentData.name?.last || '',
        email: studentData.email,
        grade: studentData.grade,
        orgs: studentData.school ? [{ sourcedId: studentData.school, name: '' }] : [],
        status: 'active',
      }

      const normalized = normalizeToStudent(oneRosterStudent, schoolMappings)
      const result = await upsertStudent(normalized, 'CLEVER')

      return { action: result, studentId: normalized.externalId }
    }

    case 'student.deleted': {
      const studentId = (eventData.id || eventData.sourcedId) as string

      if (studentId) {
        const existing = await prisma.student.findFirst({
          where: { externalId: studentId, rosterSource: 'CLEVER' },
        })

        if (existing) {
          await prisma.student.update({
            where: { id: existing.id },
            data: {
              status: 'INACTIVE',
              lastSyncedAt: new Date(),
            },
          })

          return { action: 'deactivated', studentId }
        }
      }

      return { action: 'skipped', studentId: studentId || undefined }
    }

    default:
      console.log(`[RosterSync] Unhandled Clever webhook event type: ${eventType}`)
      return { action: 'ignored' }
  }
}

// ─── ClassLink Webhook Handler ──────────────────────────────────────────────

export async function handleClassLinkWebhook(
  payload: Record<string, unknown>,
  orgId: string
): Promise<{ action: string; studentId?: string }> {
  const eventType = payload.eventType as string
  const eventData = payload.data as Record<string, unknown> | undefined

  if (!eventType || !eventData) {
    throw new Error('INVALID_WEBHOOK: Missing eventType or data in webhook payload')
  }

  const config = await prisma.iTSyncConfig.findFirst({
    where: { provider: 'classlink' },
  })

  const schoolMappings = (config?.schoolMappings as Record<string, string>) || {}

  switch (eventType) {
    case 'student.created':
    case 'student.updated': {
      const oneRosterStudent: OneRosterStudent = {
        sourcedId: eventData.sourcedId as string,
        givenName: eventData.givenName as string,
        familyName: eventData.familyName as string,
        email: eventData.email as string | undefined,
        grade: (eventData.grades as string[])?.[0],
        orgs: (eventData.orgs as { sourcedId: string; name: string }[]) || [],
        status: 'active',
      }

      const normalized = normalizeToStudent(oneRosterStudent, schoolMappings)
      const result = await upsertStudent(normalized, 'CLASSLINK')

      return { action: result, studentId: normalized.externalId }
    }

    case 'student.deleted': {
      const studentId = (eventData.sourcedId || eventData.id) as string

      if (studentId) {
        const existing = await prisma.student.findFirst({
          where: { externalId: studentId, rosterSource: 'CLASSLINK' },
        })

        if (existing) {
          await prisma.student.update({
            where: { id: existing.id },
            data: {
              status: 'INACTIVE',
              lastSyncedAt: new Date(),
            },
          })

          return { action: 'deactivated', studentId }
        }
      }

      return { action: 'skipped', studentId: studentId || undefined }
    }

    default:
      console.log(`[RosterSync] Unhandled ClassLink webhook event type: ${eventType}`)
      return { action: 'ignored' }
  }
}

// ─── Sync Dispatcher ────────────────────────────────────────────────────────

export async function syncRoster(
  orgId: string,
  provider: string
): Promise<SyncSummary> {
  switch (provider) {
    case 'clever':
      return cleverSync(orgId)
    case 'classlink':
      return classLinkSync(orgId)
    default:
      throw new Error(`UNKNOWN_PROVIDER: Roster sync provider "${provider}" is not supported. Use "clever" or "classlink".`)
  }
}
