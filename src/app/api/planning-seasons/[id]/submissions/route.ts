import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubmissions, createSubmission } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const CreateSubmissionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  preferredDate: z.string().transform((s) => new Date(s)),
  alternateDate1: z.string().transform((s) => new Date(s)).optional(),
  alternateDate2: z.string().transform((s) => new Date(s)).optional(),
  duration: z.number().int().min(15).max(1440),
  isOutdoor: z.boolean().optional(),
  expectedAttendance: z.number().int().optional(),
  targetAudience: z.string().optional(),
  priority: z.enum(['MUST_HAVE', 'IMPORTANT', 'NICE_TO_HAVE']).optional(),
  estimatedBudget: z.number().optional(),
  resourceNeeds: z.array(z.object({
    resourceType: z.enum(['FACILITY', 'AV_EQUIPMENT', 'VIP_ATTENDANCE', 'CUSTODIAL']),
    details: z.string().optional(),
  })).optional(),
})

export const GET = withAuth(async ({ params, searchParams }) => {
  const submissions = await getSubmissions(params.id, {
    status: searchParams.get('status') || undefined,
    submittedById: searchParams.get('submittedById') || undefined,
  })
  return NextResponse.json(ok(submissions))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const POST = withAuth(async ({ params, ctx, body }) => {
  const submission = await createSubmission({
    ...body,
    planningSeasonId: params.id,
    submittedById: ctx.userId,
  })
  return NextResponse.json(ok(submission), { status: 201 })
}, { permission: PERMISSIONS.PLANNING_SUBMIT, schema: CreateSubmissionSchema })
