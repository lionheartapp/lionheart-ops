/**
 * Security Incident Service
 *
 * CRUD + state management for cybersecurity incident records.
 * Chain-of-custody logging via SecurityIncidentActivity.
 * 10-year retention (retainUntil = createdAt + 10 years).
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import type {
  SecurityIncidentType,
  IncidentSeverity,
  IncidentStatus,
  IncidentActivityType,
} from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateIncidentInput {
  type: SecurityIncidentType
  severity: IncidentSeverity
  title: string
  description: string
  schoolId?: string
  affectedSystems?: string[]
  affectedDeviceIds?: string[]
  affectedUserIds?: string[]
  piiInvolved?: boolean
}

export interface IncidentFilters {
  type?: SecurityIncidentType
  severity?: IncidentSeverity
  status?: IncidentStatus
  schoolId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

// ─── Allowed Status Transitions ──────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['INVESTIGATING', 'CLOSED'],
  INVESTIGATING: ['CONTAINED', 'REMEDIATING', 'CLOSED'],
  CONTAINED: ['REMEDIATING', 'CLOSED'],
  REMEDIATING: ['CLOSED'],
  CLOSED: [],
}

// ─── Number Generation ───────────────────────────────────────────────────────

export async function generateIncidentNumber(orgId: string): Promise<string> {
  const counter = await rawPrisma.securityIncidentCounter.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, lastIncidentNumber: 1 },
    update: { lastIncidentNumber: { increment: 1 } },
  })
  return `SEC-${String(counter.lastIncidentNumber).padStart(4, '0')}`
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createIncident(
  orgId: string,
  userId: string,
  data: CreateIncidentInput
) {
  const incidentNumber = await generateIncidentNumber(orgId)
  const now = new Date()
  const retainUntil = new Date(now)
  retainUntil.setFullYear(retainUntil.getFullYear() + 10)

  const incident = await (prisma.securityIncident.create as Function)({
    data: {
      incidentNumber,
      type: data.type,
      severity: data.severity,
      status: 'OPEN',
      title: data.title,
      description: data.description,
      schoolId: data.schoolId,
      affectedSystems: data.affectedSystems ?? [],
      affectedDeviceIds: data.affectedDeviceIds ?? [],
      affectedUserIds: data.affectedUserIds ?? [],
      piiInvolved: data.piiInvolved ?? false,
      reportedById: userId,
      retainUntil,
    },
  })

  // Log CREATED activity
  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId: incident.id,
      actorId: userId,
      type: 'CREATED' as IncidentActivityType,
      content: `Incident ${incidentNumber} reported: ${data.title}`,
      metadata: {
        type: data.type,
        severity: data.severity,
        piiInvolved: data.piiInvolved ?? false,
      },
    },
  })

  return incident
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getIncidents(orgId: string, filters: IncidentFilters) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 25
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (filters.type) where.type = filters.type
  if (filters.severity) where.severity = filters.severity
  if (filters.status) where.status = filters.status
  if (filters.schoolId) where.schoolId = filters.schoolId
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { incidentNumber: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) (where.createdAt as Record<string, unknown>).gte = new Date(filters.from)
    if (filters.to) (where.createdAt as Record<string, unknown>).lte = new Date(filters.to)
  }

  const [incidents, total] = await Promise.all([
    prisma.securityIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        school: { select: { id: true, name: true } },
        _count: { select: { activities: true } },
      },
    }),
    prisma.securityIncident.count({ where }),
  ])

  return { incidents, total }
}

export async function getIncidentById(orgId: string, incidentId: string) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    include: {
      reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      school: { select: { id: true, name: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })
  return incident
}

// ─── Status Management ───────────────────────────────────────────────────────

export async function updateIncidentStatus(
  orgId: string,
  incidentId: string,
  userId: string,
  data: { status: IncidentStatus; note?: string }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { status: true },
  })
  if (!incident) throw new Error('Incident not found')

  const allowed = ALLOWED_TRANSITIONS[incident.status] ?? []
  if (!allowed.includes(data.status)) {
    throw new Error(`Cannot transition from ${incident.status} to ${data.status}`)
  }

  const updateData: Record<string, unknown> = { status: data.status }
  if (data.status === 'CLOSED') {
    updateData.closedAt = new Date()
  }

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: updateData,
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'STATUS_CHANGE' as IncidentActivityType,
      fromStatus: incident.status,
      toStatus: data.status,
      content: data.note ?? null,
    },
  })

  return updated
}

// ─── Severity Management ─────────────────────────────────────────────────────

export async function updateIncidentSeverity(
  orgId: string,
  incidentId: string,
  userId: string,
  data: { severity: IncidentSeverity; justification?: string }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { severity: true, status: true },
  })
  if (!incident) throw new Error('Incident not found')
  if (incident.status === 'CLOSED') throw new Error('Cannot modify closed incident')

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: { severity: data.severity },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'SEVERITY_CHANGE' as IncidentActivityType,
      fromSeverity: incident.severity,
      toSeverity: data.severity,
      content: data.justification ?? null,
    },
  })

  return updated
}

// ─── Close Incident ──────────────────────────────────────────────────────────

export async function closeIncident(
  orgId: string,
  incidentId: string,
  userId: string,
  data: { resolutionSummary: string; lessonsLearned?: string }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { status: true },
  })
  if (!incident) throw new Error('Incident not found')
  if (incident.status === 'CLOSED') throw new Error('Incident is already closed')

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      resolutionSummary: data.resolutionSummary,
      lessonsLearned: data.lessonsLearned ?? null,
    },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'CLOSED' as IncidentActivityType,
      fromStatus: incident.status,
      toStatus: 'CLOSED',
      content: data.resolutionSummary,
    },
  })

  return updated
}

// ─── Responders ──────────────────────────────────────────────────────────────

export async function addResponder(
  orgId: string,
  incidentId: string,
  userId: string,
  responderId: string
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { responderIds: true },
  })
  if (!incident) throw new Error('Incident not found')

  if (incident.responderIds.includes(responderId)) return incident

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: { responderIds: { push: responderId } },
  })

  // Look up responder name
  const responder = await rawPrisma.user.findUnique({
    where: { id: responderId },
    select: { firstName: true, lastName: true },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'RESPONDER_ADDED' as IncidentActivityType,
      content: `Added responder: ${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim(),
      metadata: { responderId },
    },
  })

  return updated
}

export async function removeResponder(
  orgId: string,
  incidentId: string,
  userId: string,
  responderId: string
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { responderIds: true },
  })
  if (!incident) throw new Error('Incident not found')

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: {
      responderIds: incident.responderIds.filter((id) => id !== responderId),
    },
  })

  const responder = await rawPrisma.user.findUnique({
    where: { id: responderId },
    select: { firstName: true, lastName: true },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'RESPONDER_REMOVED' as IncidentActivityType,
      content: `Removed responder: ${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim(),
      metadata: { responderId },
    },
  })

  return updated
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export async function attachEvidence(
  orgId: string,
  incidentId: string,
  userId: string,
  evidence: { url: string; fileName: string; fileHash: string }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { evidenceFiles: true },
  })
  if (!incident) throw new Error('Incident not found')

  const newEvidence = {
    url: evidence.url,
    fileName: evidence.fileName,
    fileHash: evidence.fileHash,
    uploadedAt: new Date().toISOString(),
    uploadedById: userId,
  }

  const currentFiles = (incident.evidenceFiles ?? []) as unknown[]

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: { evidenceFiles: [...currentFiles, newEvidence] as any },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'EVIDENCE_ATTACHED' as IncidentActivityType,
      content: `Attached evidence: ${evidence.fileName}`,
      metadata: { fileHash: evidence.fileHash, fileName: evidence.fileName },
    },
  })

  return updated
}

// ─── External Notifications ──────────────────────────────────────────────────

export async function logExternalNotification(
  orgId: string,
  incidentId: string,
  userId: string,
  data: { recipientType: string; method: string; notes?: string }
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { externalNotifications: true },
  })
  if (!incident) throw new Error('Incident not found')

  const newNotification = {
    recipientType: data.recipientType,
    method: data.method,
    sentAt: new Date().toISOString(),
    sentById: userId,
    notes: data.notes ?? null,
  }

  const current = (incident.externalNotifications ?? []) as unknown[]

  const updated = await prisma.securityIncident.update({
    where: { id: incidentId },
    data: { externalNotifications: [...current, newNotification] as any },
  })

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'EXTERNAL_NOTIFICATION' as IncidentActivityType,
      content: `External notification sent to ${data.recipientType} via ${data.method}`,
      metadata: data,
    },
  })

  return updated
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addComment(
  orgId: string,
  incidentId: string,
  userId: string,
  content: string
) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    select: { id: true },
  })
  if (!incident) throw new Error('Incident not found')

  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'COMMENT' as IncidentActivityType,
      content,
    },
  })
}

// ─── View Logging ────────────────────────────────────────────────────────────

export async function logIncidentView(
  orgId: string,
  incidentId: string,
  userId: string
) {
  await (prisma.securityIncidentActivity.create as Function)({
    data: {
      incidentId,
      actorId: userId,
      type: 'VIEWED' as IncidentActivityType,
    },
  })
}
