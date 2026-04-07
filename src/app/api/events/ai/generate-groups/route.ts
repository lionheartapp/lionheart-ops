/**
 * POST /api/events/ai/generate-groups
 *
 * Generates AI-suggested group assignments for an EventProject.
 * Loads participants and groups from DB, considers constraints, and returns
 * suggested assignments with reasoning. Staff reviews before applying.
 *
 * Returns AIGroupAssignmentResult or 503 if Gemini is not configured.
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { generateGroupAssignments } from '@/lib/services/ai/eventAIService'

const BodySchema = z.object({
  eventProjectId: z.string().min(1, 'eventProjectId is required'),
  constraints: z
    .object({
      balanceGender: z.boolean().optional(),
      balanceGrade: z.boolean().optional(),
      honorFriendRequests: z.boolean().optional(),
    })
    .optional(),
})

export const POST = withAuth(async ({ body }) => {
  const { eventProjectId, constraints = {} } = body

  // Load groups for this event project
  const groups = await (prisma as unknown as OrgPrismaClient).eventGroup.findMany({
    where: { eventProjectId },
    select: {
      id: true,
      name: true,
      type: true,
      capacity: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  if (groups.length === 0) {
    return NextResponse.json(
      fail('NO_GROUPS', 'No groups found for this event. Create groups before generating assignments.'),
      { status: 400 },
    )
  }

  // Load registered participants (not yet assigned to a group)
  const registrations = await (prisma as unknown as OrgPrismaClient).eventRegistration.findMany({
    where: {
      eventProjectId,
      deletedAt: null,
      status: { in: ['REGISTERED', 'WAITLIST'] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      responses: {
        select: {
          value: true,
          field: {
            select: {
              fieldKey: true,
            },
          },
        },
      },
    },
  })

  if (registrations.length === 0) {
    return NextResponse.json(
      fail('NO_PARTICIPANTS', 'No registered participants found for this event.'),
      { status: 400 },
    )
  }

  // Map to participant input shape
  interface RegistrationResponse { value: string; field?: { fieldKey: string } | null }
  interface Registration { id: string; firstName: string; lastName: string; grade?: string | null; responses: RegistrationResponse[] }
  const participants = (registrations as Registration[]).map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    grade: r.grade ?? undefined,
    // Extract gender from responses if collected
    gender: r.responses.find((res) => res.field?.fieldKey === 'gender')?.value ?? undefined,
  }))

  // Map groups to target shape — remaining capacity
  interface GroupRecord { id: string; name: string; type: string; capacity: number | null; _count: { assignments: number } }
  const groupTargets = (groups as GroupRecord[]).map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    capacity: g.capacity ?? participants.length, // default unlimited → assign everyone
  }))

  const result = await generateGroupAssignments({
    participants,
    groups: groupTargets,
    constraints,
  })

  if (!result) {
    return NextResponse.json(
      fail(
        'AI_UNAVAILABLE',
        'AI group assignment is not available. Please configure GEMINI_API_KEY to enable this feature.',
      ),
      { status: 503 },
    )
  }

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: BodySchema })
