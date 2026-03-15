/**
 * GET    /api/events/projects/[id]/documents  — list document requirements + stats
 * POST   /api/events/projects/[id]/documents  — create document requirement
 * PUT    /api/events/projects/[id]/documents  — update document requirement
 * DELETE /api/events/projects/[id]/documents  — delete document requirement
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createDocumentRequirement,
  updateDocumentRequirement,
  deleteDocumentRequirement,
  listDocumentRequirements,
} from '@/lib/services/eventDocumentService'

type RouteParams = {
  params: Promise<{ id: string }>
}

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
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const [requirements, totalRegistrations] = await Promise.all([
        listDocumentRequirements(id),
        (prisma as any).eventRegistration.count({
          where: { eventProjectId: id, status: 'REGISTERED' },
        }),
      ])

      // Calculate aggregate completion stats
      const totalRequirements = requirements.length
      let totalCompletions = 0

      if (totalRequirements > 0 && totalRegistrations > 0) {
        const completedCount = await (prisma as any).eventDocumentCompletion.count({
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}

// ─── POST /api/events/projects/[id]/documents ────────────────────────────────

/**
 * Creates a new document requirement for the event.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    const body = await req.json()
    const validated = CreateDocumentRequirementSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const requirement = await createDocumentRequirement({
        eventProjectId: id,
        ...validated,
      })
      return NextResponse.json(ok(requirement), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), {
        status: 400,
      })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}

// ─── PUT /api/events/projects/[id]/documents ─────────────────────────────────

/**
 * Updates a document requirement.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _projectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    const body = await req.json()
    const validated = UpdateDocumentRequirementSchema.parse(body)

    const { requirementId, ...updateData } = validated

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateDocumentRequirement(requirementId, updateData)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), {
        status: 400,
      })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(fail('NOT_FOUND', 'Document requirement not found'), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}

// ─── DELETE /api/events/projects/[id]/documents ──────────────────────────────

/**
 * Deletes a document requirement (and cascades to its completions).
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _projectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_DOCUMENTS_MANAGE)

    // Support both query param and body
    let requirementId: string | null = req.nextUrl.searchParams.get('requirementId')
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

    return await runWithOrgContext(orgId, async () => {
      await deleteDocumentRequirement(requirementId!)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), {
        status: 400,
      })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(fail('NOT_FOUND', 'Document requirement not found'), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}
