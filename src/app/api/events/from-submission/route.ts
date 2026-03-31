import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { createEventProject } from '@/lib/services/eventProjectService'

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
export const POST = withAuth(async ({ ctx, body }) => {
  const { submissionId, calendarId } = body

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
    isOffCampus: false,
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
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: FromSubmissionSchema })
