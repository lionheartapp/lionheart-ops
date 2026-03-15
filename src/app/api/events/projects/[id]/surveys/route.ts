import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import {
  createSurvey,
  updateSurvey,
  deleteSurvey,
  listSurveys,
} from '@/lib/services/eventSurveyService'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateSurveySchema = z.object({
  formId: z.string().cuid(),
  opensAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
})

const UpdateSurveySchema = z.object({
  surveyId: z.string().cuid(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
  opensAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
})

const DeleteSurveySchema = z.object({
  surveyId: z.string().cuid(),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_SURVEYS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const surveys = await listSurveys(params.id)
      return NextResponse.json(ok(surveys))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_SURVEYS_MANAGE)

    const body = await req.json()
    const parsed = CreateSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const survey = await createSurvey({
        eventProjectId: params.id,
        formId: parsed.data.formId,
        opensAt: parsed.data.opensAt ? new Date(parsed.data.opensAt) : null,
        closesAt: parsed.data.closesAt ? new Date(parsed.data.closesAt) : null,
      })
      return NextResponse.json(ok(survey), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params: _params }: { params: { id: string } },
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_SURVEYS_MANAGE)

    const body = await req.json()
    const parsed = UpdateSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const survey = await updateSurvey(parsed.data.surveyId, {
        status: parsed.data.status,
        opensAt: parsed.data.opensAt ? new Date(parsed.data.opensAt) : undefined,
        closesAt: parsed.data.closesAt ? new Date(parsed.data.closesAt) : undefined,
      })
      return NextResponse.json(ok(survey))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } },
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_SURVEYS_MANAGE)

    const body = await req.json()
    const parsed = DeleteSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'surveyId is required', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await deleteSurvey(parsed.data.surveyId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
