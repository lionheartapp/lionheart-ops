import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubmissionById, updateSubmission } from '@/lib/services/planningSeasonService'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const submission = await getSubmissionById(subId)
      if (!submission) return NextResponse.json(fail('NOT_FOUND', 'Submission not found'), { status: 404 })
      return NextResponse.json(ok(submission))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch submission'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_SUBMIT)
    const { subId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateSubmissionSchema.parse(body)
      const submission = await updateSubmission(subId, input)
      return NextResponse.json(ok(submission))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update submission'), { status: 500 })
  }
}
