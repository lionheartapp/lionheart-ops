/**
 * IT Content Filter Service
 *
 * Manages content filter platform integration (GoGuardian, Securly, Lightspeed, Bark),
 * HMAC webhook validation, event normalization, and CIPA audit trail.
 * Uses rawPrisma for all queries.
 */

import { rawPrisma } from '@/lib/db'
import { createHmac, randomBytes, createHash } from 'crypto'
import { createBulkNotifications } from '@/lib/services/notificationService'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NormalizedFilterEvent {
  eventType: 'UNBLOCK_REQUEST' | 'SAFETY_ALERT' | 'FILTER_EXCEPTION' | 'BLOCK_EVENT'
  externalEventId?: string
  studentName?: string
  studentEmail?: string
  url?: string
  category?: string
  teacherName?: string
  teacherEmail?: string
  isAdminOnly?: boolean
  metadata?: Record<string, unknown>
}

// ─── HMAC Validation ─────────────────────────────────────────────────────────

export function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string,
  algorithm = 'sha256'
): boolean {
  const computed = createHmac(algorithm, secret).update(body).digest('hex')
  // Constant-time comparison
  if (computed.length !== signature.length) return false
  let result = 0
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return result === 0
}

// ─── Payload Transformers ────────────────────────────────────────────────────

export function transformGoGuardianPayload(payload: Record<string, any>): NormalizedFilterEvent {
  let eventType: NormalizedFilterEvent['eventType'] = 'BLOCK_EVENT'
  let isAdminOnly = false

  if (payload.type === 'beacon_alert' || payload.event === 'safety_alert') {
    eventType = 'SAFETY_ALERT'
    isAdminOnly = true
  } else if (payload.type === 'unblock_request' || payload.event === 'unblock') {
    eventType = 'UNBLOCK_REQUEST'
  }

  return {
    eventType,
    isAdminOnly,
    studentName: payload.student?.name || payload.user_name,
    studentEmail: payload.student?.email || payload.user_email,
    url: payload.url || payload.blocked_url,
    category: payload.category,
    teacherName: payload.teacher?.name,
    teacherEmail: payload.teacher?.email,
    externalEventId: payload.id || payload.event_id,
  }
}

export function transformSecurlyPayload(payload: Record<string, any>): NormalizedFilterEvent {
  let eventType: NormalizedFilterEvent['eventType'] = 'BLOCK_EVENT'
  let isAdminOnly = false

  const type = (payload.type || '').toLowerCase()
  if (type.includes('aware') || type.includes('safety')) {
    eventType = 'SAFETY_ALERT'
    isAdminOnly = true
  } else if (type.includes('exception') || type.includes('unblock')) {
    eventType = 'FILTER_EXCEPTION'
  }

  return {
    eventType,
    isAdminOnly,
    studentName: payload.student_name,
    studentEmail: payload.student_email,
    url: payload.url,
    category: payload.category_name,
    teacherName: payload.teacher_name,
    teacherEmail: payload.teacher_email,
    externalEventId: payload.event_id || payload.id,
  }
}

export function transformLightspeedPayload(payload: Record<string, any>): NormalizedFilterEvent {
  let eventType: NormalizedFilterEvent['eventType'] = 'BLOCK_EVENT'
  let isAdminOnly = false

  const eventTypeStr = (payload.event_type || '').toLowerCase()
  if (eventTypeStr.includes('alert')) {
    eventType = 'SAFETY_ALERT'
    isAdminOnly = true
  } else if (eventTypeStr.includes('exception') || eventTypeStr.includes('unblock')) {
    eventType = 'FILTER_EXCEPTION'
  }

  return {
    eventType,
    isAdminOnly,
    studentName: payload.user?.display_name,
    studentEmail: payload.user?.email,
    url: payload.url || payload.destination,
    category: payload.category,
    externalEventId: payload.id,
  }
}

export function transformBarkPayload(payload: Record<string, any>): NormalizedFilterEvent {
  return {
    eventType: 'SAFETY_ALERT',
    isAdminOnly: true,
    studentName: payload.child_name,
    studentEmail: payload.child_email,
    category: payload.alert_type || payload.category,
    externalEventId: payload.alert_id || payload.id,
    metadata: {
      severity: payload.severity,
      platform: payload.platform,
    },
  }
}

// ─── Permission Lookup Helper ────────────────────────────────────────────────

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

// ─── Process Filter Event ────────────────────────────────────────────────────

export async function processFilterEvent(
  orgId: string,
  provider: string,
  normalizedEvent: NormalizedFilterEvent
) {
  // Create the content filter event record
  const event = await (rawPrisma.iTContentFilterEvent as any).create({
    data: {
      organizationId: orgId,
      platform: provider as any,
      eventType: normalizedEvent.eventType as any,
      externalEventId: normalizedEvent.externalEventId || null,
      studentName: normalizedEvent.studentName || null,
      studentEmail: normalizedEvent.studentEmail || null,
      url: normalizedEvent.url || null,
      category: normalizedEvent.category || null,
      teacherName: normalizedEvent.teacherName || null,
      teacherEmail: normalizedEvent.teacherEmail || null,
      isAdminOnly: normalizedEvent.isAdminOnly || false,
      metadata: normalizedEvent.metadata || null,
    },
  })

  // Auto-create IT ticket for unblock requests
  if (normalizedEvent.eventType === 'UNBLOCK_REQUEST') {
    // Generate ticket number
    const counter = await rawPrisma.iTTicketCounter.upsert({
      where: { organizationId: orgId },
      update: { lastTicketNumber: { increment: 1 } },
      create: { organizationId: orgId, lastTicketNumber: 1 },
    })
    const ticketNumber = `IT-${String(counter.lastTicketNumber).padStart(4, '0')}`

    // Generate status token
    const rawToken = randomBytes(32).toString('hex')
    const statusTokenHash = createHash('sha256').update(rawToken).digest('hex')

    const ticket = await (rawPrisma.iTTicket as any).create({
      data: {
        organizationId: orgId,
        ticketNumber,
        title: `Content Filter Unblock: ${normalizedEvent.url || 'Unknown URL'}`,
        issueType: 'SOFTWARE' as any,
        source: 'WEBHOOK' as any,
        status: 'BACKLOG' as any,
        priority: 'MEDIUM' as any,
        description: `Unblock request from ${normalizedEvent.studentName || 'student'}. URL: ${normalizedEvent.url || 'N/A'}. Category: ${normalizedEvent.category || 'N/A'}.`,
        filterPlatform: provider,
        filterEventId: event.id,
        filterDisposition: 'PENDING',
        statusToken: statusTokenHash,
      },
    })

    // Link ticket back to the event
    await (rawPrisma.iTContentFilterEvent as any).update({
      where: { id: event.id },
      data: { ticketId: ticket.id },
    })
  }

  // Send safety alert notifications to IT filter managers
  if (normalizedEvent.eventType === 'SAFETY_ALERT') {
    try {
      const managers = await getUsersWithPermission(orgId, 'it:filters:manage')
      if (managers.length > 0) {
        await createBulkNotifications(
          managers.map((u) => ({
            userId: u.id,
            type: 'it_ticket_urgent' as any,
            title: 'Safety Alert: Content Filter',
            body: `Safety alert triggered for ${normalizedEvent.studentName || 'a student'}. Category: ${normalizedEvent.category || 'Unknown'}. Platform: ${provider}.`,
            linkUrl: '/it?tab=filters',
          }))
        )
      }
    } catch (err) {
      console.error('[ContentFilter] Failed to send safety alert notifications:', err)
    }
  }

  return event
}

// ─── Management Functions ────────────────────────────────────────────────────

export async function getFilterConfigs(orgId: string) {
  return (rawPrisma.iTContentFilterConfig as any).findMany({
    where: { organizationId: orgId },
    orderBy: { provider: 'asc' },
  })
}

export async function upsertFilterConfig(
  orgId: string,
  provider: string,
  data: {
    isEnabled?: boolean
    webhookSecret?: string
    apiKey?: string
    settings?: any
  }
) {
  return (rawPrisma.iTContentFilterConfig as any).upsert({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider: provider as any,
      },
    },
    update: {
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      ...(data.webhookSecret !== undefined ? { webhookSecret: data.webhookSecret } : {}),
      ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
      ...(data.settings !== undefined ? { settings: data.settings } : {}),
    },
    create: {
      organizationId: orgId,
      provider: provider as any,
      isEnabled: data.isEnabled ?? false,
      webhookSecret: data.webhookSecret || null,
      apiKey: data.apiKey || null,
      settings: data.settings || null,
    },
  })
}

export async function getFilterEvents(
  orgId: string,
  filters: {
    platform?: string
    eventType?: string
    disposition?: string
    isAdminOnly?: boolean
    from?: string
    to?: string
    limit?: number
    offset?: number
  }
): Promise<{ events: any[]; total: number }> {
  const where: Record<string, any> = { organizationId: orgId }

  if (filters.platform) where.platform = filters.platform
  if (filters.eventType) where.eventType = filters.eventType
  if (filters.disposition) where.disposition = filters.disposition
  if (filters.isAdminOnly !== undefined) where.isAdminOnly = filters.isAdminOnly

  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) where.createdAt.gte = new Date(filters.from)
    if (filters.to) where.createdAt.lte = new Date(filters.to)
  }

  const [events, total] = await Promise.all([
    (rawPrisma.iTContentFilterEvent as any).findMany({
      where,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
        ticket: { select: { id: true, ticketNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    (rawPrisma.iTContentFilterEvent as any).count({ where }),
  ])

  return { events, total }
}

export async function updateEventDisposition(
  orgId: string,
  eventId: string,
  userId: string,
  data: { disposition: string; notes?: string }
) {
  const event = await (rawPrisma.iTContentFilterEvent as any).update({
    where: { id: eventId },
    data: {
      disposition: data.disposition as any,
      dispositionAt: new Date(),
      actorId: userId,
      dispositionNotes: data.notes || null,
    },
  })

  // If the event has a linked ticket, update its filterDisposition too
  if (event.ticketId) {
    await (rawPrisma.iTTicket as any).update({
      where: { id: event.ticketId },
      data: { filterDisposition: data.disposition },
    })
  }

  return event
}
