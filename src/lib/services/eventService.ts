import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { Event } from '@prisma/client'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { stripAllHtml } from '@/lib/sanitize'

// ============= Validation Schemas =============

export const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).transform(stripAllHtml),
  description: z.string().transform(stripAllHtml).optional().nullable(),
  room: z.string().transform(stripAllHtml).optional().nullable(),
  startsAt: z.string().datetime().or(z.date()),
  endsAt: z.string().datetime().or(z.date()),
  submittedById: z.string().optional().nullable(),
})

export const UpdateEventSchema = CreateEventSchema.partial()

export const ListEventsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  skip: z.number().int().min(0).default(0),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>
export type ListEventsInput = z.infer<typeof ListEventsSchema>

// ============= Room Conflict Detection =============

/**
 * Check if a room is already booked during the given time range.
 * Skips events with CANCELLED status. Comparison is case-insensitive.
 * @param room Room name to check
 * @param startsAt Start of the proposed booking
 * @param endsAt End of the proposed booking
 * @param excludeId Optional event ID to exclude from check (for updates)
 */
async function checkRoomConflict(
  room: string | null | undefined,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
): Promise<void> {
  if (!room || !room.trim()) return

  const conflict = await prisma.event.findFirst({
    where: {
      room: { equals: room.trim(), mode: 'insensitive' },
      status: { not: 'CANCELLED' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, title: true, startsAt: true, endsAt: true },
  })

  if (conflict) {
    const err = new Error(
      `Room "${room.trim()}" is already booked from ${conflict.startsAt.toISOString()} to ${conflict.endsAt.toISOString()} ("${conflict.title}")`
    ) as Error & { code: string }
    err.code = 'ROOM_CONFLICT'
    throw err
  }
}

export { checkRoomConflict }

// ============= Service Functions =============

/**
 * List events with pagination and filtering
 * @param input Query parameters
 * @param userId User ID for permission check
 */
export async function listEvents(
  input: Partial<ListEventsInput>,
  userId: string
): Promise<Event[]> {
  await assertCan(userId, PERMISSIONS.EVENTS_READ)

  const validated = ListEventsSchema.parse(input)

  const where: any = {}
  if (validated.status) {
    where.status = validated.status
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: 'desc' },
    take: validated.limit,
    skip: validated.skip,
    include: {
      submittedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return events
}

/**
 * Count events matching the given filters (for pagination metadata)
 */
export async function countEvents(
  input: Partial<ListEventsInput>,
  userId: string
): Promise<number> {
  await assertCan(userId, PERMISSIONS.EVENTS_READ)

  const validated = ListEventsSchema.parse(input)
  const where: any = {}
  if (validated.status) where.status = validated.status

  return prisma.event.count({ where })
}

/**
 * Get single event by ID
 * @param id Event ID
 * @param userId User ID for permission check
 */
export async function getEventById(id: string, userId: string): Promise<Event | null> {
  await assertCan(userId, PERMISSIONS.EVENTS_READ)

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      submittedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return event
}

/**
 * Create a new event
 * Requires events:create permission
 * @param input Event data
 * @param userId Creating user ID
 */
export async function createEvent(
  input: CreateEventInput,
  userId: string
): Promise<Event> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)

  const validated = CreateEventSchema.parse(input)

  if (validated.room) {
    await checkRoomConflict(validated.room, new Date(validated.startsAt), new Date(validated.endsAt))
  }

  const event = await prisma.event.create({
    data: {
      title: validated.title,
      description: validated.description,
      room: validated.room,
      startsAt: new Date(validated.startsAt),
      endsAt: new Date(validated.endsAt),
      status: 'CONFIRMED',
      submittedById: validated.submittedById || userId,
    } as any, // Temp workaround for org-scoped extension typing
  })

  return event
}

/**
 * Update an existing event
 * Requires events:update_own permission (or events:approve for all)
 * @param id Event ID
 * @param input Updated event data
 * @param userId User ID for permission check
 */
export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  userId: string
): Promise<Event> {
  await assertCan(userId, PERMISSIONS.EVENTS_UPDATE_OWN)

  const validated = UpdateEventSchema.parse(input)

  // Check room conflict if room or times are being changed
  if (validated.room !== undefined || validated.startsAt !== undefined || validated.endsAt !== undefined) {
    const existing = await prisma.event.findUnique({
      where: { id },
      select: { room: true, startsAt: true, endsAt: true },
    })
    if (existing) {
      const effectiveRoom = validated.room !== undefined ? validated.room : existing.room
      const effectiveStart = validated.startsAt !== undefined ? new Date(validated.startsAt) : existing.startsAt
      const effectiveEnd = validated.endsAt !== undefined ? new Date(validated.endsAt) : existing.endsAt
      await checkRoomConflict(effectiveRoom, effectiveStart, effectiveEnd, id)
    }
  }

  const updateData: any = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.description !== undefined) updateData.description = validated.description
  if (validated.room !== undefined) updateData.room = validated.room
  if (validated.startsAt !== undefined) updateData.startsAt = new Date(validated.startsAt)
  if (validated.endsAt !== undefined) updateData.endsAt = new Date(validated.endsAt)

  const event = await prisma.event.update({
    where: { id },
    data: updateData,
  })

  return event
}

/**
 * Cancel an event (soft delete via status)
 * Requires events:approve permission (admin-level action)
 * @param id Event ID
 * @param userId User ID for permission check
 */
export async function cancelEvent(id: string, userId: string): Promise<Event> {
  await assertCan(userId, PERMISSIONS.EVENTS_APPROVE)

  const event = await prisma.event.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return event
}

/**
 * Delete an event permanently
 * Requires events:delete permission
 * @param id Event ID
 * @param userId User ID for permission check
 */
export async function deleteEvent(id: string, userId: string): Promise<void> {
  await assertCan(userId, PERMISSIONS.EVENTS_DELETE)

  await prisma.event.delete({
    where: { id },
  })
}
