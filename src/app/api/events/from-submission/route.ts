import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createEventProject } from '@/lib/services/eventProjectService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/from-submission' })

const FromSubmissionSchema = z.object({
  submissionId: z.string().min(1, 'submissionId is required'),
  calendarId: z.string().optional(),
})

/**
 * POST /api/events/from-submission
 *
 * Creates an EventProject from an already-approved PlanningSubmission.
 * The submission must have status APPROVED or PUBLISHED to proceed.
 * The resulting EventProject uses source=PLANNING_SUBMISSION and is
 * auto-confirmed (CalendarEvent bridge is created immediately).
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const { submissionId, calendarId } = FromSubmissionSchema.parse(body)

      // Fetch the PlanningSubmission — use org-scoped prisma
      const db = prisma as any
      const submission = await db.planningSubmission.findUnique({
        where: { id: submissionId },
      })

      if (!submission) {
        return NextResponse.json(fail('NOT_FOUND', 'PlanningSubmission not found'), { status: 404 })
      }

      const approvedStatuses = ['APPROVED', 'PUBLISHED']
      if (!approvedStatuses.includes(submission.submissionStatus)) {
        return NextResponse.json(
          fail(
            'INVALID_STATE',
            `PlanningSubmission must be APPROVED or PUBLISHED to create an EventProject. Current status: ${submission.submissionStatus}`,
          ),
          { status: 400 },
        )
      }

      // Compute endsAt from duration (stored as minutes)
      const startsAt = new Date(submission.preferredDate)
      const endsAt = new Date(startsAt.getTime() + submission.duration * 60000)

      const projectData = {
        title: submission.title,
        description: submission.description ?? undefined,
        startsAt,
        endsAt,
        isMultiDay: false,
        requiresAV: false,
        requiresFacilities: false,
        expectedAttendance: submission.expectedAttendance ?? undefined,
        calendarId: calendarId ?? undefined,
      }

      const project = await createEventProject(
        projectData,
        ctx.userId,
        'PLANNING_SUBMISSION',
        submissionId,
      )

      return NextResponse.json(ok(project), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create EventProject from submission')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
