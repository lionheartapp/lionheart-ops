/**
 * GET    /api/events/projects/[id]/compliance  — list compliance items (or defaults if ?defaults=true)
 * POST   /api/events/projects/[id]/compliance  — create compliance item
 * PUT    /api/events/projects/[id]/compliance  — update compliance item
 * DELETE /api/events/projects/[id]/compliance  — delete compliance item
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listComplianceItems,
  upsertComplianceItem,
  deleteComplianceItem,
  getDefaultComplianceChecklist,
} from '@/lib/services/eventDocumentService'

type RouteParams = {
  params: Promise<{ id: string }>
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const COMPLIANCE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'] as const

const CreateComplianceItemSchema = z.object({
  label: z.string().min(1).max(300),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const UpdateComplianceItemSchema = z.object({
  itemId: z.string().min(1),
  label: z.string().min(1).max(300),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const DeleteComplianceItemSchema = z.object({
  itemId: z.string().min(1),
})

// ─── GET /api/events/projects/[id]/compliance ────────────────────────────────

/**
 * Returns compliance checklist items for an event.
 * If ?defaults=true, returns the static default checklist instead.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_COMPLIANCE_MANAGE)

    const useDefaults = req.nextUrl.searchParams.get('defaults') === 'true'

    if (useDefaults) {
      const defaults = getDefaultComplianceChecklist()
      return NextResponse.json(ok(defaults))
    }

    return await runWithOrgContext(orgId, async () => {
      const items = await listComplianceItems(id)
      return NextResponse.json(ok(items))
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

// ─── POST /api/events/projects/[id]/compliance ───────────────────────────────

/**
 * Creates a new compliance checklist item for the event.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_COMPLIANCE_MANAGE)

    const body = await req.json()
    const validated = CreateComplianceItemSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const item = await upsertComplianceItem({
        eventProjectId: id,
        ...validated,
      })
      return NextResponse.json(ok(item), { status: 201 })
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

// ─── PUT /api/events/projects/[id]/compliance ────────────────────────────────

/**
 * Updates an existing compliance checklist item.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_COMPLIANCE_MANAGE)

    const body = await req.json()
    const validated = UpdateComplianceItemSchema.parse(body)

    const { itemId, ...updateFields } = validated

    return await runWithOrgContext(orgId, async () => {
      const item = await upsertComplianceItem({
        id: itemId,
        eventProjectId: id,
        ...updateFields,
      })
      return NextResponse.json(ok(item))
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
      return NextResponse.json(fail('NOT_FOUND', 'Compliance item not found'), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}

// ─── DELETE /api/events/projects/[id]/compliance ─────────────────────────────

/**
 * Deletes a compliance checklist item.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _projectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENTS_COMPLIANCE_MANAGE)

    // Support both query param and body
    let itemId: string | null = req.nextUrl.searchParams.get('itemId')
    if (!itemId) {
      const body = await req.json()
      const validated = DeleteComplianceItemSchema.parse(body)
      itemId = validated.itemId
    }

    if (!itemId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'itemId is required'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      await deleteComplianceItem(itemId!)
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
      return NextResponse.json(fail('NOT_FOUND', 'Compliance item not found'), { status: 404 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}
