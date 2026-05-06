/**
 * Event Project Service — Schedule Block & Task CRUD
 *
 * CRUD operations for schedule blocks and tasks within an EventProject,
 * with activity log tracking for all mutations.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'
import { appendActivityLog } from './eventProjectService'
import type {
  CreateScheduleBlockInput,
  UpdateScheduleBlockInput,
  CreateEventTaskInput,
  UpdateEventTaskInput,
} from '@/lib/types/event-project'

const db = prisma as unknown as OrgPrismaClient

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
    'sectionId',
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

// ─── My Tasks (cross-event) ─────────────────────────────────────────────────

/**
 * Returns all tasks across all events in the org where the given user is the
 * assignee. Each task is returned with the bare-minimum event context the UI
 * needs to render outside the event page (title, dates, location label).
 *
 * Excludes tasks from soft-deleted events. Optionally filters by status.
 */
export async function getTasksForAssignee(
  assigneeId: string,
  options?: { status?: string },
): Promise<Record<string, unknown>[]> {
  return db.eventTask.findMany({
    where: {
      assigneeId,
      ...(options?.status ? { status: options.status } : {}),
      // Exclude tasks from soft-deleted events. The org-scoped client already
      // filters EventProject.deletedAt = null on relation reads, but here we
      // want the filter on the parent before we even pull the row.
      eventProject: { deletedAt: null },
    },
    orderBy: [
      { dueDate: 'asc' },
      { priority: 'desc' },
    ],
    include: {
      eventProject: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          building: { select: { id: true, name: true } },
          room: { select: { id: true, displayName: true, roomNumber: true } },
        },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

/**
 * Lookup helper for the task PATCH route to authorize an assignee acting on
 * their own task. Returns the task if the user is the assignee, otherwise null.
 */
export async function findTaskIfAssignee(
  taskId: string,
  userId: string,
): Promise<{ id: string; assigneeId: string | null; eventProjectId: string } | null> {
  const task = await db.eventTask.findFirst({
    where: { id: taskId, assigneeId: userId },
    select: { id: true, assigneeId: true, eventProjectId: true },
  })
  return task
}
