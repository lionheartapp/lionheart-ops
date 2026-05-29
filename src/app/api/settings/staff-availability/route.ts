import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line no-restricted-imports -- Staff availability reads routing/team helper records with explicit orgId filters after withAuth.
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const UpdateAvailabilitySchema = z.object({
  userId: z.string().min(1),
  module: z.enum(['MAINTENANCE', 'IT']),
  status: z.enum(['AVAILABLE', 'OUT_OF_OFFICE']).optional(),
  outUntil: z.string().datetime().nullable().optional(),
  maxActiveTickets: z.number().int().min(1).max(100).optional(),
  delegateUserId: z.string().nullable().optional(),
  workingHours: z.record(z.string(), z.string()).nullable().optional(),
  skillTags: z.array(z.string()).optional(),
})

// Team slugs that map to each moduleParam
const MODULE_TEAM_SLUGS: Record<string, string> = {
  MAINTENANCE: 'maintenance',
  IT: 'it-support',
}

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const moduleParam = searchParams.get('module')
  if (!moduleParam || !['MAINTENANCE', 'IT'].includes(moduleParam)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'moduleParam query param required (MAINTENANCE or IT)'),
      { status: 400 }
    )
  }

  // Find users who are on the relevant team for this moduleParam
  const teamSlug = MODULE_TEAM_SLUGS[moduleParam]
  const eligibleUsers = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: 'ACTIVE',
      teams: {
        some: {
          team: { slug: teamSlug },
        },
      },
    },
    select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
  })

  // Auto-create StaffAvailability records for users who don't have one yet
  const existingRecords = await rawPrisma.staffAvailability.findMany({
    where: { organizationId: orgId, module: moduleParam as 'MAINTENANCE' | 'IT' },
    select: { userId: true },
  })
  const existingUserIds = new Set(existingRecords.map((r) => r.userId))

  const newUsers = eligibleUsers.filter((u) => !existingUserIds.has(u.id))
  if (newUsers.length > 0) {
    await rawPrisma.staffAvailability.createMany({
      data: newUsers.map((u) => ({
        organizationId: orgId,
        userId: u.id,
        module: moduleParam as 'MAINTENANCE' | 'IT',
        status: 'AVAILABLE' as const,
        maxActiveTickets: 10,
      })),
      skipDuplicates: true,
    })
  }

  // Fetch all records (including newly created)
  const availabilities = await rawPrisma.staffAvailability.findMany({
    where: {
      organizationId: orgId,
      module: moduleParam as 'MAINTENANCE' | 'IT',
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
      const openTickets = moduleParam === 'MAINTENANCE'
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

const DeleteAvailabilitySchema = z.object({
  userId: z.string().min(1),
  module: z.enum(['MAINTENANCE', 'IT']),
})

export const DELETE = withAuth<z.infer<typeof DeleteAvailabilitySchema>>(async ({ orgId, body }) => {
  const { userId, module } = body

  await rawPrisma.staffAvailability.deleteMany({
    where: {
      organizationId: orgId,
      userId,
      module,
    },
  })

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: DeleteAvailabilitySchema })
