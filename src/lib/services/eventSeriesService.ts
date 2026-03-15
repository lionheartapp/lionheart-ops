import { prisma } from '@/lib/db'
import { createEventProject } from './eventProjectService'
import type { CreateEventSeriesInput, UpdateEventSeriesInput } from '@/lib/types/event-project'

// The db cast is needed because the org-scoped extension models are typed as `any`
const db = prisma as any

// ─── EventSeries CRUD ────────────────────────────────────────────────────────

/**
 * Creates a new EventSeries record.
 * The series acts as a template for spawning EventProject instances.
 */
export async function createEventSeries(
  data: CreateEventSeriesInput,
  createdById: string,
): Promise<Record<string, unknown>> {
  return db.eventSeries.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      rrule: data.rrule ?? null,
      defaultStartTime: data.defaultStartTime ?? null,
      defaultDuration: data.defaultDuration ?? null,
      defaultLocationText: data.defaultLocationText ?? null,
      defaultBuildingId: data.defaultBuildingId ?? null,
      defaultRoomId: data.defaultRoomId ?? null,
      resourceNeeds: data.resourceNeeds ?? null,
      campusId: data.campusId ?? null,
      isActive: true,
      createdById,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { projects: true } },
    },
  })
}

/**
 * Fetches a single EventSeries with its spawned projects.
 */
export async function getEventSeries(id: string): Promise<Record<string, unknown> | null> {
  return db.eventSeries.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      projects: {
        orderBy: { startsAt: 'asc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { tasks: true } },
        },
      },
    },
  })
}

/**
 * Lists EventSeries records, optionally filtered by isActive status.
 */
export async function listEventSeries(filters?: {
  isActive?: boolean
  campusId?: string
}): Promise<Record<string, unknown>[]> {
  return db.eventSeries.findMany({
    where: {
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.campusId ? { campusId: filters.campusId } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Updates fields on an EventSeries.
 */
export async function updateEventSeries(
  id: string,
  data: UpdateEventSeriesInput,
): Promise<Record<string, unknown>> {
  const updateData: Record<string, unknown> = {}
  const fields: Array<keyof UpdateEventSeriesInput> = [
    'title',
    'description',
    'rrule',
    'defaultStartTime',
    'defaultDuration',
    'defaultLocationText',
    'defaultBuildingId',
    'defaultRoomId',
    'resourceNeeds',
    'isActive',
  ]

  for (const field of fields) {
    if (field in data) {
      updateData[field] = (data as Record<string, unknown>)[field] ?? null
    }
  }

  return db.eventSeries.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { projects: true } },
    },
  })
}

/**
 * Deactivates an EventSeries (sets isActive=false).
 * Existing projects are not affected — only future spawning is disabled.
 */
export async function deactivateEventSeries(id: string): Promise<Record<string, unknown>> {
  return db.eventSeries.update({
    where: { id },
    data: { isActive: false },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { projects: true } },
    },
  })
}

// ─── Spawn Project from Series ───────────────────────────────────────────────

/**
 * Spawns a new EventProject from an EventSeries template.
 * Merges series defaults with any provided overrides.
 * The created project uses source=SERIES and is auto-confirmed.
 */
export async function spawnProjectFromSeries(
  seriesId: string,
  overrides: {
    title?: string
    description?: string
    startsAt: Date
    endsAt?: Date
    calendarId?: string
    campusId?: string
    schoolId?: string
    locationText?: string
    buildingId?: string
    roomId?: string
    expectedAttendance?: number
  },
  createdById: string,
): Promise<Record<string, unknown>> {
  const series = await db.eventSeries.findUnique({
    where: { id: seriesId },
  })

  if (!series) {
    throw new Error(`EventSeries not found: ${seriesId}`)
  }

  if (!series.isActive) {
    throw new Error(`Cannot spawn from inactive EventSeries: ${seriesId}`)
  }

  // Compute endsAt from defaultDuration if not explicitly provided
  let resolvedEndsAt = overrides.endsAt
  if (!resolvedEndsAt && series.defaultDuration) {
    resolvedEndsAt = new Date(overrides.startsAt.getTime() + series.defaultDuration * 60000)
  }
  if (!resolvedEndsAt) {
    // Default to 1 hour if no duration info
    resolvedEndsAt = new Date(overrides.startsAt.getTime() + 60 * 60000)
  }

  const projectData = {
    title: overrides.title ?? series.title,
    description: overrides.description ?? series.description ?? undefined,
    startsAt: overrides.startsAt,
    endsAt: resolvedEndsAt,
    locationText: overrides.locationText ?? series.defaultLocationText ?? undefined,
    buildingId: overrides.buildingId ?? series.defaultBuildingId ?? undefined,
    roomId: overrides.roomId ?? series.defaultRoomId ?? undefined,
    campusId: overrides.campusId ?? series.campusId ?? undefined,
    schoolId: overrides.schoolId ?? undefined,
    calendarId: overrides.calendarId ?? undefined,
    expectedAttendance: overrides.expectedAttendance ?? undefined,
    isMultiDay: false,
  }

  // createEventProject with source=SERIES auto-confirms and creates CalendarEvent bridge
  return createEventProject(projectData, createdById, 'SERIES', seriesId)
}
