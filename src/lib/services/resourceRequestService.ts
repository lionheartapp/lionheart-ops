import { prisma } from '@/lib/db'

const db = prisma as any

export async function getResourceRequests(filters?: {
  status?: string
  resourceType?: string
  eventId?: string
}) {
  return db.eventResourceRequest.findMany({
    where: {
      ...(filters?.status ? { requestStatus: filters.status } : {}),
      ...(filters?.resourceType ? { resourceType: filters.resourceType } : {}),
      ...(filters?.eventId ? { eventId: filters.eventId } : {}),
    },
    include: {
      event: {
        select: { id: true, title: true, startTime: true, endTime: true, locationText: true },
      },
      respondedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getResourceRequestById(id: string) {
  return db.eventResourceRequest.findUnique({
    where: { id },
    include: {
      event: {
        select: { id: true, title: true, startTime: true, endTime: true, locationText: true, calendarId: true },
      },
      respondedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

export async function createResourceRequest(data: {
  eventId: string
  resourceType: string
  details?: Record<string, unknown>
}) {
  return db.eventResourceRequest.create({
    data: {
      eventId: data.eventId,
      resourceType: data.resourceType,
      details: data.details || null,
      requestStatus: 'PENDING',
    },
    include: {
      event: { select: { id: true, title: true } },
    },
  })
}

export async function createBulkResourceRequests(eventId: string, requests: Array<{
  resourceType: string
  details?: Record<string, unknown>
}>) {
  const results = []
  for (const req of requests) {
    const result = await createResourceRequest({ eventId, ...req })
    results.push(result)
  }
  return results
}

export async function respondToResourceRequest(id: string, data: {
  requestStatus: string
  responseNote?: string
  respondedById: string
}) {
  return db.eventResourceRequest.update({
    where: { id },
    data: {
      requestStatus: data.requestStatus,
      responseNote: data.responseNote || null,
      respondedById: data.respondedById,
      respondedAt: new Date(),
    },
    include: {
      event: { select: { id: true, title: true } },
      respondedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

export async function getEventResourceRequests(eventId: string) {
  return db.eventResourceRequest.findMany({
    where: { eventId },
    include: {
      respondedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}
