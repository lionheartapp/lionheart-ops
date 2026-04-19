import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const UpdateAvailabilitySchema = z.object({
  userId: z.string().min(1),
  module: z.enum(['MAINTENANCE', 'IT']),
  status: z.enum(['AVAILABLE', 'OUT_OF_OFFICE']).optional(),
  outUntil: z.string().datetime().nullable().optional(),
  maxActiveTickets: z.number().int().min(1).max(100).optional(),
  delegateUserId: z.string().nullable().optional(),
  workingHours: z.record(z.string()).nullable().optional(),
  skillTags: z.array(z.string()).optional(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const module = searchParams.get('module')
  if (!module || !['MAINTENANCE', 'IT'].includes(module)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'module query param required (MAINTENANCE or IT)'),
      { status: 400 }
    )
  }

  const availabilities = await prisma.staffAvailability.findMany({
    where: {
      organizationId: orgId,
      module: module as 'MAINTENANCE' | 'IT',
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      delegate: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Enrich with open ticket counts
  const enriched = await Promise.all(
    availabilities.map(async (avail) => {
      const openTickets = module === 'MAINTENANCE'
        ? await rawPrisma.maintenanceTicket.count({
            where: {
              organizationId: orgId,
              assignedToId: avail.userId,
              status: { notIn: ['DONE', 'CANCELLED'] },
              deletedAt: null,
            },
          })
        : await rawPrisma.iTTicket.count({
            where: {
              organizationId: orgId,
              assignedToId: avail.userId,
              status: { notIn: ['DONE', 'CANCELLED'] },
              deletedAt: null,
            },
          })

      return { ...avail, openTickets }
    })
  )

  return NextResponse.json(ok(enriched))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateAvailabilitySchema>>(async ({ orgId, body }) => {
  const { userId, module, status, outUntil, maxActiveTickets, delegateUserId, workingHours, skillTags } = body

  // Upsert — create if doesn't exist
  const existing = await rawPrisma.staffAvailability.findUnique({
    where: {
      organizationId_userId_module: {
        organizationId: orgId,
        userId,
        module,
      },
    },
  })

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (outUntil !== undefined) updateData.outUntil = outUntil ? new Date(outUntil) : null
  if (maxActiveTickets !== undefined) updateData.maxActiveTickets = maxActiveTickets
  if (delegateUserId !== undefined) updateData.delegateUserId = delegateUserId
  if (workingHours !== undefined) updateData.workingHours = workingHours
  if (skillTags !== undefined) updateData.skillTags = skillTags

  const result = existing
    ? await rawPrisma.staffAvailability.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      })
    : await rawPrisma.staffAvailability.create({
        data: {
          organizationId: orgId,
          userId,
          module,
          status: status ?? 'AVAILABLE',
          outUntil: outUntil ? new Date(outUntil) : null,
          maxActiveTickets: maxActiveTickets ?? 10,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      })

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateAvailabilitySchema })
