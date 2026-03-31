import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubmissionById, updateSubmission } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const UpdateSubmissionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().optional(),
  preferredDate: z.string().transform((s) => new Date(s)).optional(),
  alternateDate1: z.string().transform((s) => new Date(s)).nullable().optional(),
  alternateDate2: z.string().transform((s) => new Date(s)).nullable().optional(),
  duration: z.number().int().min(15).max(1440).optional(),
  isOutdoor: z.boolean().optional(),
  expectedAttendance: z.number().int().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  priority: z.enum(['MUST_HAVE', 'IMPORTANT', 'NICE_TO_HAVE']).optional(),
  estimatedBudget: z.number().nullable().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const submission = await getSubmissionById(params.subId)
  if (!submission) return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
  return NextResponse.json(ok(submission))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const PUT = withAuth(async ({ params, body }) => {
  const submission = await updateSubmission(params.subId, body)
  return NextResponse.json(ok(submission))
}, { permission: PERMISSIONS.PLANNING_SUBMIT, schema: UpdateSubmissionSchema })
