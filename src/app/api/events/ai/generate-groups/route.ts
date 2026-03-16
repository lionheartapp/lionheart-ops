/**
 * POST /api/events/ai/generate-groups
 *
 * Generates AI-suggested group assignments for an EventProject.
 * Loads participants and groups from DB, considers constraints, and returns
 * suggested assignments with reasoning. Staff reviews before applying.
 *
 * Returns AIGroupAssignmentResult or 503 if Gemini is not configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
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

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    const { eventProjectId, constraints = {} } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      // Load groups for this event project
      const groups = await (prisma as any).eventGroup.findMany({
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
      const registrations = await (prisma as any).eventRegistration.findMany({
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
      const participants = registrations.map((r: any) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        grade: r.grade ?? undefined,
        // Extract gender from responses if collected
        gender: r.responses.find((res: any) => res.field?.fieldKey === 'gender')?.value ?? undefined,
      }))

      // Map groups to target shape — remaining capacity
      const groupTargets = groups.map((g: any) => ({
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
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', error.issues),
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/events/ai/generate-groups]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
