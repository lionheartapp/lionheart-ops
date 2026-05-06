import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { withAuth } from '@/lib/api/with-auth'

const CreateAssignmentSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
  isPrimary: z.boolean().optional(),
})

/**
 * GET /api/settings/campus/room-assignments
 *
 * List room assignments. Filter by roomId or userId.
 */
export const GET = withAuth(async ({ orgId, searchParams }) => {
  const roomId = searchParams.get('roomId') || undefined
  const userId = searchParams.get('userId') || undefined
  const buildingId = searchParams.get('buildingId') || undefined

  const assignments = await prisma.userRoomAssignment.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      ...(roomId ? { roomId } : {}),
      ...(userId ? { userId } : {}),
      ...(buildingId ? { room: { buildingId } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          jobTitle: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          displayName: true,
          buildingId: true,
        },
      },
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(ok(assignments))
}, { permission: PERMISSIONS.SETTINGS_READ })

/**
 * POST /api/settings/campus/room-assignments
 *
 * Assign a user to a room. If the user already has an active assignment
 * for this room, returns the existing one.
 */
export const POST = withAuth(async ({ orgId, body }) => {
  // Verify room belongs to this org
  const room = await prisma.room.findFirst({
    where: { id: body.roomId, organizationId: orgId },
    select: { id: true },
  })
  if (!room) {
    return NextResponse.json(fail('BAD_REQUEST', 'Room not found'), { status: 400 })
  }

  // Verify user belongs to this org
  const user = await prisma.user.findFirst({
    where: { id: body.userId, organizationId: orgId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json(fail('BAD_REQUEST', 'User not found'), { status: 400 })
  }

  // Check for existing active assignment
  const existing = await prisma.userRoomAssignment.findFirst({
    where: {
      organizationId: orgId,
      roomId: body.roomId,
      userId: body.userId,
      isActive: true,
    },
  })
  if (existing) {
    return NextResponse.json(ok(existing))
  }

  const assignment = await prisma.userRoomAssignment.create({
    data: {
      organizationId: orgId,
      roomId: body.roomId,
      userId: body.userId,
      isPrimary: body.isPrimary ?? false,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          jobTitle: true,
        },
      },
    },
  })

  return NextResponse.json(ok(assignment), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateAssignmentSchema })
