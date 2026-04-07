/**
 * GET    /api/events/projects/[id]/documents  — list document requirements + stats
 * POST   /api/events/projects/[id]/documents  — create document requirement
 * PUT    /api/events/projects/[id]/documents  — update document requirement
 * DELETE /api/events/projects/[id]/documents  — delete document requirement
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import {
  createDocumentRequirement,
  updateDocumentRequirement,
  deleteDocumentRequirement,
  listDocumentRequirements,
} from '@/lib/services/eventDocumentService'

// ─── Validation Schemas ───────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  'permission_slip',
  'waiver',
  'medical_release',
  'photo_release',
  'custom',
] as const

const CreateDocumentRequirementSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  documentType: z.enum(DOCUMENT_TYPES),
  isRequired: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const UpdateDocumentRequirementSchema = z.object({
  requirementId: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  isRequired: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const DeleteDocumentRequirementSchema = z.object({
  requirementId: z.string().min(1),
})

// ─── GET /api/events/projects/[id]/documents ─────────────────────────────────

/**
 * Returns document requirements for an event plus completion stats.
 */
export const GET = withAuth(async ({ params }) => {
  const id = params.id

  const [requirements, totalRegistrations] = await Promise.all([
    listDocumentRequirements(id),
    (prisma as unknown as OrgPrismaClient).eventRegistration.count({
      where: { eventProjectId: id, status: 'REGISTERED' },
    }),
  ])

  // Calculate aggregate completion stats
  const totalRequirements = requirements.length
  let totalCompletions = 0

  if (totalRequirements > 0 && totalRegistrations > 0) {
    const completedCount = await (prisma as unknown as OrgPrismaClient).eventDocumentCompletion.count({
      where: {
        eventProjectId: id,
        isComplete: true,
      },
    })
    totalCompletions = completedCount
  }

  const possibleCompletions = totalRequirements * totalRegistrations
  const completionPercentage =
    possibleCompletions > 0
      ? Math.round((totalCompletions / possibleCompletions) * 100)
      : 0

  return NextResponse.json(
    ok({
      requirements,
      stats: {
        totalRequirements,
        totalRegistrations,
        totalCompletions,
        completionPercentage,
      },
    }),
  )
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE })

// ─── POST /api/events/projects/[id]/documents ────────────────────────────────

/**
 * Creates a new document requirement for the event.
 */
export const POST = withAuth(async ({ params, body }) => {
  const requirement = await createDocumentRequirement({
    eventProjectId: params.id,
    ...body,
  })
  return NextResponse.json(ok(requirement), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE, schema: CreateDocumentRequirementSchema })

// ─── PUT /api/events/projects/[id]/documents ─────────────────────────────────

/**
 * Updates a document requirement.
 */
export const PUT = withAuth(async ({ body }) => {
  const { requirementId, ...updateData } = body
  const updated = await updateDocumentRequirement(requirementId, updateData)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE, schema: UpdateDocumentRequirementSchema })

// ─── DELETE /api/events/projects/[id]/documents ──────────────────────────────

/**
 * Deletes a document requirement (and cascades to its completions).
 */
export const DELETE = withAuth(async ({ req, searchParams }) => {
  // Support both query param and body
  let requirementId: string | null = searchParams.get('requirementId')
  if (!requirementId) {
    const body = await req.json()
    const validated = DeleteDocumentRequirementSchema.parse(body)
    requirementId = validated.requirementId
  }

  if (!requirementId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'requirementId is required'), {
      status: 400,
    })
  }

  await deleteDocumentRequirement(requirementId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_DOCUMENTS_MANAGE })
