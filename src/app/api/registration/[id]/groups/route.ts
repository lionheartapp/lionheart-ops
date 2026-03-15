/**
 * Public portal route — no auth required.
 * Registration ID is the access credential.
 *
 * GET /api/registration/[id]/groups
 * Returns group assignments for a specific registration.
 * Covered by the existing middleware public rule:
 *   if (pathname.startsWith('/api/registration/')) return true
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: registrationId } = await params

    // Verify registration exists
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true, deletedAt: true },
    })

    if (!registration || registration.deletedAt) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
    }

    // Fetch group assignments for this registration
    const assignments = await rawPrisma.eventGroupAssignment.findMany({
      where: { registrationId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            leader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    })

    const result = assignments.map((a) => ({
      groupId: a.group.id,
      groupName: a.group.name,
      groupType: a.group.type,
      description: a.group.description,
      leaderName: a.group.leader
        ? `${a.group.leader.firstName ?? ''} ${a.group.leader.lastName ?? ''}`.trim() || null
        : null,
      assignedAt: a.assignedAt,
    }))

    return NextResponse.json(ok(result))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
