import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSubmissions, createSubmission } from '@/lib/services/planningSeasonService'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const submissions = await getSubmissions(id, {
        status: searchParams.get('status') || undefined,
        submittedById: searchParams.get('submittedById') || undefined,
      })
      return NextResponse.json(ok(submissions))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch submissions'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_SUBMIT)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = CreateSubmissionSchema.parse(body)
      const submission = await createSubmission({
        ...input,
        planningSeasonId: id,
        submittedById: ctx.userId,
      })
      return NextResponse.json(ok(submission), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create submission'), { status: 500 })
  }
}
