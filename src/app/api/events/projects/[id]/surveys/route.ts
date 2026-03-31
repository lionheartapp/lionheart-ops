/**
 * Surveys API for an EventProject.
 *
 * GET    /api/events/projects/[id]/surveys         — list surveys
 * POST   /api/events/projects/[id]/surveys         — create survey
 * PUT    /api/events/projects/[id]/surveys         — update survey
 * DELETE /api/events/projects/[id]/surveys         — delete survey
 *
 * Requires: events:surveys:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
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

export const GET = withAuth(async ({ params }) => {
  const surveys = await listSurveys(params.id)
  return NextResponse.json(ok(surveys))
}, { permission: PERMISSIONS.EVENTS_SURVEYS_MANAGE })

export const POST = withAuth(async ({ params, body }) => {
  const survey = await createSurvey({
    eventProjectId: params.id,
    formId: body.formId,
    opensAt: body.opensAt ? new Date(body.opensAt) : null,
    closesAt: body.closesAt ? new Date(body.closesAt) : null,
  })
  return NextResponse.json(ok(survey), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_SURVEYS_MANAGE, schema: CreateSurveySchema })

export const PUT = withAuth(async ({ body }) => {
  const survey = await updateSurvey(body.surveyId, {
    status: body.status,
    opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
    closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
  })
  return NextResponse.json(ok(survey))
}, { permission: PERMISSIONS.EVENTS_SURVEYS_MANAGE, schema: UpdateSurveySchema })

export const DELETE = withAuth(async ({ body }) => {
  await deleteSurvey(body.surveyId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_SURVEYS_MANAGE, schema: DeleteSurveySchema })
