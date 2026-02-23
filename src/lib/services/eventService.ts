import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { Event } from '@prisma/client'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// ============= Validation Schemas =============

export const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  startsAt: z.string().datetime().or(z.date()),
  endsAt: z.string().datetime().or(z.date()),
  submittedById: z.string().optional().nullable(),
})

export const UpdateEventSchema = CreateEventSchema.partial()

export const ListEventsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>
export type ListEventsInput = z.infer<typeof ListEventsSchema>

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
    skip: validated.offset,
    include: {
      submittedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return events
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
