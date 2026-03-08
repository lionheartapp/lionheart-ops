/**
 * Security Incident Notification Service
 *
 * Severity-based auto-notifications (fire-and-forget).
 *
 * | Severity | Notify                                          |
 * |----------|-------------------------------------------------|
 * | LOW      | IT Coordinator only (it:incident:read)          |
 * | MEDIUM   | + Campus Admin (it:incident:manage)             |
 * | HIGH     | + Superintendent                                |
 * | CRITICAL | + Org Admin, full protocol                      |
 */

import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { createBulkNotifications } from '@/lib/services/notificationService'

// ─── Types ───────────────────────────────────────────────────────────────────

type IncidentSnapshot = {
  id: string
  incidentNumber: string
  title: string
  severity: string
  type: string
  piiInvolved: boolean
  reportedById: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

function incidentLink(): string {
  return `${getAppUrl()}/it?tab=security-incidents`
}

function severityLabel(severity: string): string {
  const labels: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
  }
  return labels[severity] || severity
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    PHISHING: 'Phishing',
    DEVICE_LOST_STOLEN: 'Device Lost/Stolen',
    UNAUTHORIZED_ACCESS: 'Unauthorized Access',
    MALWARE: 'Malware',
    DATA_BREACH: 'Data Breach',
    ACCOUNT_COMPROMISE: 'Account Compromise',
    RANSOMWARE: 'Ransomware',
    POLICY_VIOLATION: 'Policy Violation',
    OTHER: 'Other',
  }
  return labels[type] || type
}

/**
 * Get all users in an org who have a specific permission.
 */
async function getUsersWithPermission(
  orgId: string,
  permission: string
): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  const parts = permission.split(':')
  const resource = parts[0] || ''
  const action = parts[1] || ''
  const scope = parts[2]

  const permWhere = scope
    ? [{ resource, action, scope }]
    : [{ resource, action, scope: 'global' }]

  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              OR: [
                { resource: '*', action: '*' }, // super-admin wildcard
                ...permWhere,
              ],
            },
          },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
  }))
}

/**
 * Build notification recipients based on severity level.
 * Higher severity = wider notification scope.
 */
async function getRecipientsForSeverity(
  orgId: string,
  severity: string
): Promise<{ id: string; email: string }[]> {
  const recipientSet = new Map<string, { id: string; email: string }>()

  // LOW+ — IT coordinators (anyone with it:incident:read)
  const itReaders = await getUsersWithPermission(orgId, PERMISSIONS.IT_INCIDENT_READ)
  for (const u of itReaders) recipientSet.set(u.id, { id: u.id, email: u.email })

  if (severity === 'LOW') return Array.from(recipientSet.values())

  // MEDIUM+ — Campus admin / incident managers
  const managers = await getUsersWithPermission(orgId, PERMISSIONS.IT_INCIDENT_MANAGE)
  for (const u of managers) recipientSet.set(u.id, { id: u.id, email: u.email })

  if (severity === 'MEDIUM') return Array.from(recipientSet.values())

  // HIGH+ — All admins (settings:update implies campus admin or higher)
  const admins = await getUsersWithPermission(orgId, PERMISSIONS.SETTINGS_UPDATE)
  for (const u of admins) recipientSet.set(u.id, { id: u.id, email: u.email })

  // CRITICAL — already includes super-admins via wildcard match
  return Array.from(recipientSet.values())
}

// ─── Notification Triggers ───────────────────────────────────────────────────

/**
 * Incident created — notify based on severity
 */
export async function notifyIncidentCreated(
  incident: IncidentSnapshot,
  orgId: string
): Promise<void> {
  try {
    const link = incidentLink()
    const recipients = await getRecipientsForSeverity(orgId, incident.severity)
    if (recipients.length === 0) return

    const sevLabel = severityLabel(incident.severity)
    const typeStr = typeLabel(incident.type)
    const prefix = incident.severity === 'CRITICAL' ? 'CRITICAL: ' : ''

    await createBulkNotifications(
      recipients.map((u) => ({
        userId: u.id,
        type: 'security_incident_created' as const,
        title: `${prefix}Security Incident ${incident.incidentNumber}`,
        body: `${sevLabel} ${typeStr} incident reported: "${incident.title}"${incident.piiInvolved ? ' (PII involved)' : ''}`,
        linkUrl: link,
      }))
    )
  } catch (err) {
    console.error('[SecurityIncidentNotify] notifyIncidentCreated failed:', err)
  }
}

/**
 * Severity escalated — notify wider audience at new severity level
 */
export async function notifyIncidentSeverityEscalated(
  incident: IncidentSnapshot,
  fromSeverity: string,
  toSeverity: string,
  orgId: string
): Promise<void> {
  try {
    const link = incidentLink()
    const recipients = await getRecipientsForSeverity(orgId, toSeverity)
    if (recipients.length === 0) return

    const prefix = toSeverity === 'CRITICAL' ? 'CRITICAL ESCALATION: ' : ''

    await createBulkNotifications(
      recipients.map((u) => ({
        userId: u.id,
        type: 'security_incident_escalated' as const,
        title: `${prefix}${incident.incidentNumber} escalated to ${severityLabel(toSeverity)}`,
        body: `Security incident "${incident.title}" escalated from ${severityLabel(fromSeverity)} to ${severityLabel(toSeverity)}.`,
        linkUrl: link,
      }))
    )
  } catch (err) {
    console.error('[SecurityIncidentNotify] notifyIncidentSeverityEscalated failed:', err)
  }
}

/**
 * Status changed — notify responders
 */
export async function notifyIncidentStatusChanged(
  incident: IncidentSnapshot,
  fromStatus: string,
  toStatus: string,
  orgId: string
): Promise<void> {
  try {
    const link = incidentLink()
    // Notify all incident readers
    const readers = await getUsersWithPermission(orgId, PERMISSIONS.IT_INCIDENT_READ)
    if (readers.length === 0) return

    const statusLabels: Record<string, string> = {
      OPEN: 'Open',
      INVESTIGATING: 'Investigating',
      CONTAINED: 'Contained',
      REMEDIATING: 'Remediating',
      CLOSED: 'Closed',
    }

    await createBulkNotifications(
      readers.map((u) => ({
        userId: u.id,
        type: 'security_incident_status' as const,
        title: `${incident.incidentNumber}: ${statusLabels[toStatus] || toStatus}`,
        body: `Security incident "${incident.title}" moved from ${statusLabels[fromStatus] || fromStatus} to ${statusLabels[toStatus] || toStatus}.`,
        linkUrl: link,
      }))
    )
  } catch (err) {
    console.error('[SecurityIncidentNotify] notifyIncidentStatusChanged failed:', err)
  }
}

/**
 * Incident closed — notify all involved
 */
export async function notifyIncidentClosed(
  incident: IncidentSnapshot,
  orgId: string
): Promise<void> {
  try {
    const link = incidentLink()
    const readers = await getUsersWithPermission(orgId, PERMISSIONS.IT_INCIDENT_READ)
    if (readers.length === 0) return

    await createBulkNotifications(
      readers.map((u) => ({
        userId: u.id,
        type: 'security_incident_closed' as const,
        title: `${incident.incidentNumber} closed`,
        body: `Security incident "${incident.title}" has been resolved and closed.`,
        linkUrl: link,
      }))
    )
  } catch (err) {
    console.error('[SecurityIncidentNotify] notifyIncidentClosed failed:', err)
  }
}
