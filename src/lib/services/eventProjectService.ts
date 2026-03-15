import { prisma } from '@/lib/db'
import type {
  CreateEventProjectInput,
  UpdateEventProjectInput,
  CreateScheduleBlockInput,
  UpdateScheduleBlockInput,
  CreateEventTaskInput,
  UpdateEventTaskInput,
} from '@/lib/types/event-project'

// The db cast is needed because the org-scoped extension models are typed as `any`
const db = prisma as any

// ─── Activity Log ───────────────────────────────────────────────────────────

/**
 * Appends an immutable activity log entry to an EventProject.
 * This is the core audit trail mechanism — call it after EVERY mutation.
 * Rows are never updated or deleted.
 */
export async function appendActivityLog(
  eventProjectId: string,
  actorId: string,
  type: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.eventActivityLog.create({
    data: {
      eventProjectId,
      actorId,
      type,
      metadata: metadata ?? null,
    },
  })
}

// ─── EventProject CRUD ──────────────────────────────────────────────────────

/**
 * Creates a new EventProject from one of three sources:
 * - DIRECT_REQUEST: status = PENDING_APPROVAL (requires admin approval)
 * - PLANNING_SUBMISSION: status = CONFIRMED (auto-confirms via bulkPublish)
 * - SERIES: status = CONFIRMED (spawned from a series template)
 *
 * For PLANNING_SUBMISSION and SERIES sources, confirmEventProject is called
 * automatically to create the CalendarEvent bridge record.
 */
export async function createEventProject(
  data: CreateEventProjectInput,
  createdById: string,
  source: 'DIRECT_REQUEST' | 'PLANNING_SUBMISSION' | 'SERIES',
  sourceId?: string,
): Promise<Record<string, unknown>> {
  const isDirectRequest = source === 'DIRECT_REQUEST'
  const initialStatus = isDirectRequest ? 'PENDING_APPROVAL' : 'CONFIRMED'

  const project = await db.eventProject.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isMultiDay: data.isMultiDay ?? false,
      expectedAttendance: data.expectedAttendance ?? null,
      locationText: data.locationText ?? null,
      buildingId: data.buildingId ?? null,
      areaId: data.areaId ?? null,
      roomId: data.roomId ?? null,
      campusId: data.campusId ?? null,
      schoolId: data.schoolId ?? null,
      calendarId: data.calendarId ?? null,
      status: initialStatus,
      source,
      sourceId: sourceId ?? null,
      createdById,
      metadata: data.metadata ?? null,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      scheduleBlocks: true,
      tasks: true,
      activityLog: { orderBy: { createdAt: 'desc' } },
    },
  })

  await appendActivityLog(project.id, createdById, 'CREATED', {
    source,
    sourceId: sourceId ?? null,
    initialStatus,
  })

  // For non-direct-request sources, auto-confirm by creating the CalendarEvent bridge
  if (!isDirectRequest) {
    await confirmEventProject(project.id, createdById)
  }

  return project
}

/**
 * Fetches a single EventProject with full nested data.
 */
export async function getEventProject(id: string): Promise<Record<string, unknown> | null> {
  return db.eventProject.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      scheduleBlocks: {
        orderBy: { startsAt: 'asc' },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      tasks: {
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      activityLog: {
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      area: { select: { id: true, name: true } },
      room: { select: { id: true, name: true } },
    },
  })
}

/**
 * Lists EventProjects with optional status filtering, ordered by start date.
 */
export async function listEventProjects(filters?: {
  status?: string
  campusId?: string
  schoolId?: string
  createdById?: string
}): Promise<Record<string, unknown>[]> {
  return db.eventProject.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.campusId ? { campusId: filters.campusId } : {}),
      ...(filters?.schoolId ? { schoolId: filters.schoolId } : {}),
      ...(filters?.createdById ? { createdById: filters.createdById } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { tasks: true, scheduleBlocks: true } },
    },
    orderBy: { startsAt: 'asc' },
  })
}

/**
 * Updates an EventProject's fields.
 * Compares old vs new values to build detailed metadata for the activity log.
 */
export async function updateEventProject(
  id: string,
  data: UpdateEventProjectInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)

  // Track which fields changed for the activity log
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = []
  const updateData: Record<string, unknown> = {}

  const trackableFields: Array<keyof UpdateEventProjectInput> = [
    'title',
    'description',
    'startsAt',
    'endsAt',
    'isMultiDay',
    'expectedAttendance',
    'locationText',
    'buildingId',
    'areaId',
    'roomId',
    'campusId',
    'schoolId',
    'calendarId',
  ]

  for (const field of trackableFields) {
    if (field in data) {
      const newVal = data[field]
      const oldVal = existing[field]
      if (newVal !== oldVal) {
        changes.push({ field, oldValue: oldVal ?? null, newValue: newVal ?? null })
      }
      updateData[field] = newVal ?? null
    }
  }

  // Handle metadata separately (not tracked field-by-field)
  if ('metadata' in data) {
    updateData.metadata = data.metadata ?? null
  }

  const updated = await db.eventProject.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (changes.length > 0) {
    await appendActivityLog(id, actorId, 'FIELD_UPDATED', { changes })
  }

  return updated
}

/**
 * Approves a PENDING_APPROVAL EventProject.
 * Validates current status, transitions to CONFIRMED, records approver, then
 * creates the CalendarEvent bridge via confirmEventProject.
 */
export async function approveEventProject(
  id: string,
  approverId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)
  if (existing.status !== 'PENDING_APPROVAL') {
    throw new Error(
      `Cannot approve EventProject in status ${existing.status}. Expected PENDING_APPROVAL.`,
    )
  }

  const updated = await db.eventProject.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      approvedById: approverId,
      approvedAt: new Date(),
    },
  })

  await appendActivityLog(id, approverId, 'APPROVAL_GRANTED', {
    fromStatus: 'PENDING_APPROVAL',
    toStatus: 'CONFIRMED',
  })

  // Create the CalendarEvent bridge now that it's approved
  await confirmEventProject(id, approverId)

  return updated
}

/**
 * Rejects a PENDING_APPROVAL EventProject, setting status to CANCELLED.
 */
export async function rejectEventProject(
  id: string,
  actorId: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventProject.findUnique({ where: { id } })
  if (!existing) throw new Error(`EventProject not found: ${id}`)

  const updated = await db.eventProject.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  await appendActivityLog(id, actorId, 'APPROVAL_REJECTED', {
    fromStatus: existing.status,
    toStatus: 'CANCELLED',
    reason: reason ?? null,
  })

  return updated
}

/**
 * Creates a CalendarEvent bridge record linking this EventProject to the calendar.
 * This is the ONLY place CalendarEvents should be created for EventProjects.
 * Sets sourceModule='event-project' and sourceId=project.id for the bridge pattern.
 *
 * If the project has no calendarId, falls back to the org's first active default calendar.
 * If no calendar exists, logs a warning and skips creation.
 */
export async function confirmEventProject(
  id: string,
  actorId: string,
): Promise<void> {
  const project = await db.eventProject.findUnique({ where: { id } })
  if (!project) throw new Error(`EventProject not found: ${id}`)

  let resolvedCalendarId = project.calendarId

  if (!resolvedCalendarId) {
    // Fall back to first active calendar in the org (prefer isDefault=true)
    const defaultCalendar = await db.calendar.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })

    if (!defaultCalendar) {
      console.warn(
        `[confirmEventProject] No calendar found for EventProject ${id} — skipping CalendarEvent bridge creation`,
      )
      await appendActivityLog(id, actorId, 'STATUS_CHANGE', {
        fromStatus: project.status,
        toStatus: 'CONFIRMED',
        note: 'No calendar available — bridge skipped',
      })
      return
    }

    resolvedCalendarId = defaultCalendar.id
  }

  await db.calendarEvent.create({
    data: {
      calendarId: resolvedCalendarId,
      title: project.title,
      description: project.description ?? null,
      startTime: project.startsAt,
      endTime: project.endsAt,
      isAllDay: false,
      calendarStatus: 'CONFIRMED',
      sourceModule: 'event-project',
      sourceId: project.id,
      createdById: actorId,
      locationText: project.locationText ?? null,
      buildingId: project.buildingId ?? null,
      areaId: project.areaId ?? null,
      metadata: { eventProjectId: project.id },
    },
  })

  await appendActivityLog(id, actorId, 'STATUS_CHANGE', {
    fromStatus: project.status,
    toStatus: 'CONFIRMED',
    calendarId: resolvedCalendarId,
    bridgeCreated: true,
  })
}

// ─── Activity Log Queries ───────────────────────────────────────────────────

/**
 * Returns all activity log entries for an EventProject, newest first.
 */
export async function getActivityLog(
  eventProjectId: string,
): Promise<Record<string, unknown>[]> {
  return db.eventActivityLog.findMany({
    where: { eventProjectId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })
}

// ─── Schedule Block CRUD ────────────────────────────────────────────────────

/**
 * Creates a schedule block within an EventProject.
 */
export async function createScheduleBlock(
  eventProjectId: string,
  data: CreateScheduleBlockInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const block = await db.eventScheduleBlock.create({
    data: {
      eventProjectId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      locationText: data.locationText ?? null,
      leadId: data.leadId ?? null,
      sortOrder: data.sortOrder ?? 0,
      metadata: data.metadata ?? null,
    },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  await appendActivityLog(eventProjectId, actorId, 'SCHEDULE_BLOCK_ADDED', {
    blockId: block.id,
    title: block.title,
    type: block.type,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
  })

  return block
}

/**
 * Updates a schedule block.
 */
export async function updateScheduleBlock(
  blockId: string,
  data: UpdateScheduleBlockInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventScheduleBlock.findUnique({ where: { id: blockId } })
  if (!existing) throw new Error(`EventScheduleBlock not found: ${blockId}`)

  const updateData: Record<string, unknown> = {}
  const updatableFields: Array<keyof UpdateScheduleBlockInput> = [
    'type',
    'title',
    'description',
    'startsAt',
    'endsAt',
    'locationText',
    'leadId',
    'sortOrder',
    'metadata',
  ]

  for (const field of updatableFields) {
    if (field in data) {
      updateData[field] = (data as Record<string, unknown>)[field] ?? null
    }
  }

  const updated = await db.eventScheduleBlock.update({
    where: { id: blockId },
    data: updateData,
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  await appendActivityLog(existing.eventProjectId, actorId, 'SCHEDULE_BLOCK_UPDATED', {
    blockId,
    title: updated.title,
  })

  return updated
}

/**
 * Deletes a schedule block (hard delete — schedule blocks are not soft-deleted).
 */
export async function deleteScheduleBlock(
  blockId: string,
  actorId: string,
  eventProjectId: string,
): Promise<void> {
  const existing = await db.eventScheduleBlock.findUnique({ where: { id: blockId } })
  if (!existing) throw new Error(`EventScheduleBlock not found: ${blockId}`)

  await db.eventScheduleBlock.delete({ where: { id: blockId } })

  await appendActivityLog(eventProjectId, actorId, 'SCHEDULE_BLOCK_REMOVED', {
    blockId,
    title: existing.title,
    type: existing.type,
  })
}

// ─── Event Task CRUD ─────────────────────────────────────────────────────────

/**
 * Creates a task within an EventProject.
 */
export async function createEventTask(
  eventProjectId: string,
  data: CreateEventTaskInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const task = await db.eventTask.create({
    data: {
      eventProjectId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'NORMAL',
      category: data.category ?? null,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? null,
      createdById: actorId,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  await appendActivityLog(eventProjectId, actorId, 'TASK_CREATED', {
    taskId: task.id,
    title: task.title,
    priority: task.priority,
    assigneeId: task.assigneeId,
  })

  return task
}

/**
 * Updates a task within an EventProject.
 * If status changes to DONE, sets completedAt and appends TASK_COMPLETED.
 * Otherwise appends TASK_UPDATED.
 */
export async function updateEventTask(
  taskId: string,
  data: UpdateEventTaskInput,
  actorId: string,
  eventProjectId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventTask.findUnique({ where: { id: taskId } })
  if (!existing) throw new Error(`EventTask not found: ${taskId}`)

  const updateData: Record<string, unknown> = {}
  const updatableFields: Array<keyof UpdateEventTaskInput> = [
    'title',
    'description',
    'status',
    'priority',
    'category',
    'assigneeId',
    'dueDate',
  ]

  for (const field of updatableFields) {
    if (field in data) {
      updateData[field] = (data as Record<string, unknown>)[field] ?? null
    }
  }

  const isCompletingNow = data.status === 'DONE' && existing.status !== 'DONE'
  if (isCompletingNow) {
    updateData.completedAt = new Date()
  }

  const updated = await db.eventTask.update({
    where: { id: taskId },
    data: updateData,
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (isCompletingNow) {
    await appendActivityLog(eventProjectId, actorId, 'TASK_COMPLETED', {
      taskId,
      title: updated.title,
      completedAt: updated.completedAt,
    })
  } else {
    await appendActivityLog(eventProjectId, actorId, 'TASK_UPDATED', {
      taskId,
      title: updated.title,
      changes: Object.keys(updateData),
    })
  }

  return updated
}
