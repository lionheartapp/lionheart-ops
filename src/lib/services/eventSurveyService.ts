/**
 * Event Survey Service
 *
 * Post-event feedback surveys that reuse the RegistrationForm builder.
 * Handles CRUD, status transitions, response submission, and results aggregation.
 */

import { prisma, rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { EventSurveyWithStats } from '@/lib/types/events-phase21'

const log = logger.child({ service: 'eventSurveyService' })

// ─── Service Functions ────────────────────────────────────────────────────────

export interface CreateSurveyInput {
  eventProjectId: string
  formId: string
  opensAt?: Date | null
  closesAt?: Date | null
}

/**
 * Create a new survey for an event project, reusing an existing RegistrationForm as the template.
 */
export async function createSurvey(data: CreateSurveyInput): Promise<EventSurveyWithStats> {
  const survey = await prisma.eventSurvey.create({
    data: {
      eventProjectId: data.eventProjectId,
      formId: data.formId,
      status: 'DRAFT',
      opensAt: data.opensAt ?? null,
      closesAt: data.closesAt ?? null,
    } as any,
    include: {
      form: { select: { title: true } },
      _count: { select: { responses: true } },
    },
  }) as any

  return shapeSurvey(survey)
}

export interface UpdateSurveyInput {
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  opensAt?: Date | null
  closesAt?: Date | null
}

/**
 * Update survey settings. Supports status transitions: DRAFT -> ACTIVE -> CLOSED.
 */
export async function updateSurvey(
  id: string,
  data: UpdateSurveyInput,
): Promise<EventSurveyWithStats> {
  const survey = await prisma.eventSurvey.update({
    where: { id } as any,
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.opensAt !== undefined ? { opensAt: data.opensAt } : {}),
      ...(data.closesAt !== undefined ? { closesAt: data.closesAt } : {}),
    } as any,
    include: {
      form: { select: { title: true } },
      _count: { select: { responses: true } },
    },
  }) as any

  return shapeSurvey(survey)
}

/**
 * Hard-delete a survey by ID.
 */
export async function deleteSurvey(id: string): Promise<void> {
  await prisma.eventSurvey.delete({ where: { id } } as any)
}

/**
 * List all surveys for an event project with response counts.
 */
export async function listSurveys(eventProjectId: string): Promise<EventSurveyWithStats[]> {
  const rows = await prisma.eventSurvey.findMany({
    where: { eventProjectId } as any,
    orderBy: { createdAt: 'desc' },
    include: {
      form: { select: { title: true } },
      _count: { select: { responses: true } },
    },
  }) as any[]

  return rows.map(shapeSurvey)
}

export interface SubmitSurveyResponseInput {
  surveyId: string
  registrationId: string
  responses: Record<string, unknown>
}

/**
 * Submit a participant's survey response.
 * Validates survey is ACTIVE and not past closesAt.
 * Enforces unique constraint (one response per registration per survey).
 */
export async function submitSurveyResponse(
  data: SubmitSurveyResponseInput,
): Promise<{ id: string; submittedAt: string }> {
  // Load the survey (use rawPrisma — public submission, no org context required)
  const survey = await rawPrisma.eventSurvey.findUnique({
    where: { id: data.surveyId },
    select: {
      id: true,
      eventProjectId: true,
      organizationId: true,
      status: true,
      closesAt: true,
    },
  })

  if (!survey) {
    throw new Error('Survey not found')
  }

  if (survey.status !== 'ACTIVE') {
    throw new Error('Survey is not accepting responses')
  }

  if (survey.closesAt && new Date() > survey.closesAt) {
    throw new Error('Survey has closed')
  }

  // Verify the registrationId belongs to this survey's event project
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: data.registrationId },
    select: { id: true, eventProjectId: true, organizationId: true },
  })

  if (!registration) {
    throw new Error('Registration not found')
  }

  if (registration.eventProjectId !== survey.eventProjectId) {
    throw new Error('Registration does not belong to this event')
  }

  // Check for existing response — unique constraint will also enforce this at DB level
  const existing = await rawPrisma.eventSurveyResponse.findUnique({
    where: {
      surveyId_registrationId: {
        surveyId: data.surveyId,
        registrationId: data.registrationId,
      },
    },
    select: { id: true },
  })

  if (existing) {
    throw new Error('Response already submitted for this survey')
  }

  const response = await rawPrisma.eventSurveyResponse.create({
    data: {
      surveyId: data.surveyId,
      registrationId: data.registrationId,
      organizationId: registration.organizationId,
      responses: data.responses as any,
    },
    select: { id: true, submittedAt: true },
  })

  return {
    id: response.id,
    submittedAt: response.submittedAt.toISOString(),
  }
}

export interface SurveyResults {
  surveyId: string
  totalResponses: number
  responses: Array<{
    id: string
    registrationId: string
    participantName: string
    participantEmail: string
    responses: Record<string, unknown>
    submittedAt: string
  }>
  // Simple field-level aggregation for structured field types
  aggregation: Record<string, {
    type: 'choices' | 'text'
    counts?: Record<string, number>  // for dropdowns/checkboxes
    textValues?: string[]            // for open-ended text
  }>
}

/**
 * Fetch all survey responses with participant info and basic aggregation.
 */
export async function getSurveyResults(surveyId: string): Promise<SurveyResults> {
  const responses = await prisma.eventSurveyResponse.findMany({
    where: { surveyId } as any,
    orderBy: { submittedAt: 'asc' },
    include: {
      registration: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  }) as any[]

  const shaped = responses.map((r: any) => ({
    id: r.id,
    registrationId: r.registrationId,
    participantName: `${r.registration.firstName} ${r.registration.lastName}`.trim(),
    participantEmail: r.registration.email,
    responses: r.responses as Record<string, unknown>,
    submittedAt: r.submittedAt.toISOString(),
  }))

  // Build aggregation map from all responses
  const aggregation: SurveyResults['aggregation'] = {}

  for (const resp of shaped) {
    for (const [fieldKey, value] of Object.entries(resp.responses)) {
      if (!aggregation[fieldKey]) {
        // Determine type based on value shape
        const isChoice = typeof value === 'string' || Array.isArray(value)
        aggregation[fieldKey] = isChoice
          ? { type: 'choices', counts: {} }
          : { type: 'text', textValues: [] }
      }

      const agg = aggregation[fieldKey]

      if (agg.type === 'choices' && agg.counts) {
        const values = Array.isArray(value) ? value : [value]
        for (const v of values) {
          const key = String(v)
          agg.counts[key] = (agg.counts[key] ?? 0) + 1
        }
      } else if (agg.type === 'text' && agg.textValues) {
        if (value && typeof value === 'string' && value.trim()) {
          agg.textValues.push(value.trim())
        }
      }
    }
  }

  return {
    surveyId,
    totalResponses: shaped.length,
    responses: shaped,
    aggregation,
  }
}

// ─── Internal Shaping ─────────────────────────────────────────────────────────

function shapeSurvey(row: any): EventSurveyWithStats {
  return {
    id: row.id,
    eventProjectId: row.eventProjectId,
    formId: row.formId,
    formTitle: row.form?.title ?? null,
    status: row.status,
    opensAt: row.opensAt?.toISOString() ?? null,
    closesAt: row.closesAt?.toISOString() ?? null,
    responseCount: row._count?.responses ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
