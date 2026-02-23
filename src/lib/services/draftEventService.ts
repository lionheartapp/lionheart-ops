import { z } from 'zod'
import { prisma } from '@/lib/db'
import { DraftEvent, DraftEventStatus } from '@prisma/client'
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// ============= Validation Schemas =============

export const CreateDraftEventSchema = z.object({
  title: z.string().default(''),
  description: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  startsAt: z.string().datetime().or(z.date()).optional().nullable(),
  endsAt: z.string().datetime().or(z.date()).optional().nullable(),
})

export const UpdateDraftEventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  startsAt: z.string().datetime().or(z.date()).optional().nullable(),
  endsAt: z.string().datetime().or(z.date()).optional().nullable(),
  status: z.enum(['DRAFT', 'READY', 'SUBMITTED']).optional(),
})

export const ListDraftEventsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  status: z.enum(['DRAFT', 'READY', 'SUBMITTED']).optional(),
})

export type CreateDraftEventInput = z.infer<typeof CreateDraftEventSchema>
export type UpdateDraftEventInput = z.infer<typeof UpdateDraftEventSchema>
export type ListDraftEventsInput = z.infer<typeof ListDraftEventsSchema>

// ============= Service Functions =============

/**
 * List draft events with pagination and filtering
 * @param input Query parameters
 * @param userId User ID for filtering (users see their own drafts unless they have events:approve)
 */
export async function listDraftEvents(
  input: Partial<ListDraftEventsInput>,
  userId: string
): Promise<DraftEvent[]> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)

  const validated = ListDraftEventsSchema.parse(input)

  const where: any = {}
  if (validated.status) {
    where.status = validated.status
  }

  // Users with events:approve can see all drafts, others only see their own
  const canViewAll = await can(userId, PERMISSIONS.EVENTS_APPROVE)
  if (!canViewAll) {
    where.createdById = userId
  }

  const drafts = await prisma.draftEvent.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: validated.limit,
    skip: validated.offset,
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return drafts
}

/**
 * Get single draft event by ID
 * @param id Draft event ID
 * @param userId User ID for ownership check
 */
export async function getDraftEventById(
  id: string,
  userId: string
): Promise<DraftEvent | null> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)

  const draft = await prisma.draftEvent.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!draft) return null

  // Users with events:approve can view all drafts, others only their own
  const canViewAll = await can(userId, PERMISSIONS.EVENTS_APPROVE)
  if (!canViewAll && draft.createdById !== userId) {
    throw new Error('Access denied: You can only view your own drafts')
  }

  return draft
}

/**
 * Create a new draft event
 * Requires events:create permission
 * @param input Draft event data
 * @param userId Creating user ID
 */
export async function createDraftEvent(
  input: CreateDraftEventInput,
  userId: string
): Promise<DraftEvent> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)
  const validated = CreateDraftEventSchema.parse(input)

  const draft = await prisma.draftEvent.create({
    data: {
      title: validated.title,
      description: validated.description,
      room: validated.room,
      startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
      endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
      status: 'DRAFT',
      createdById: userId,
    } as any, // Temp workaround for org-scoped extension typing
  })

  return draft
}

/**
 * Update an existing draft event
 * Users can update their own drafts, users with events:approve can update any
 * @param id Draft event ID
 * @param input Updated draft data
 * @param userId User ID for ownership check
 */
export async function updateDraftEvent(
  id: string,
  input: UpdateDraftEventInput,
  userId: string
): Promise<DraftEvent> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)

  // Check ownership
  const existing = await prisma.draftEvent.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Draft event not found')
  }

  // Users with events:approve can update any draft, others only their own
  const canUpdateAll = await can(userId, PERMISSIONS.EVENTS_APPROVE)
  if (!canUpdateAll && existing.createdById !== userId) {
    throw new Error('Access denied: You can only update your own drafts')
  }

  const validated = UpdateDraftEventSchema.parse(input)

  const updateData: any = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.description !== undefined) updateData.description = validated.description
  if (validated.room !== undefined) updateData.room = validated.room
  if (validated.startsAt !== undefined)
    updateData.startsAt = validated.startsAt ? new Date(validated.startsAt) : null
  if (validated.endsAt !== undefined)
    updateData.endsAt = validated.endsAt ? new Date(validated.endsAt) : null
  if (validated.status !== undefined) updateData.status = validated.status

  const draft = await prisma.draftEvent.update({
    where: { id },
    data: updateData,
  })

  return draft
}

/**
 * Delete a draft event
 * Users can delete their own drafts, users with events:approve can delete any
 * @param id Draft event ID
 * @param userId User ID for ownership check
 */
export async function deleteDraftEvent(
  id: string,
  userId: string
): Promise<void> {
  await assertCan(userId, PERMISSIONS.EVENTS_CREATE)

  // Check ownership
  const existing = await prisma.draftEvent.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Draft event not found')
  }

  // Users with events:approve can delete any draft, others only their own
  const canDeleteAll = await can(userId, PERMISSIONS.EVENTS_APPROVE)
  if (!canDeleteAll && existing.createdById !== userId) {
    throw new Error('Access denied: You can only delete your own drafts')
  }

  await prisma.draftEvent.delete({
    where: { id },
  })
}

/**
 * Submit a draft event (convert to confirmed event)
 * Requires events:approve permission
 * @param id Draft event ID
 * @param userId User ID for permission check
 */
export async function submitDraftEvent(
  id: string,
  userId: string
): Promise<{ draft: DraftEvent; eventId: string }> {
  await assertCan(userId, PERMISSIONS.EVENTS_APPROVE)

  const draft = await prisma.draftEvent.findUnique({ where: { id } })
  if (!draft) {
    throw new Error('Draft event not found')
  }

  if (!draft.startsAt || !draft.endsAt) {
    throw new Error('Draft must have start and end times before submission')
  }

  // Create confirmed event from draft
  const event = await prisma.event.create({
    data: {
      title: draft.title,
      description: draft.description,
      room: draft.room,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      status: 'CONFIRMED',
      submittedById: draft.createdById,
    } as any,
  })

  // Mark draft as submitted
  const updatedDraft = await prisma.draftEvent.update({
    where: { id },
    data: { status: 'SUBMITTED' },
  })

  return { draft: updatedDraft, eventId: event.id }
}
