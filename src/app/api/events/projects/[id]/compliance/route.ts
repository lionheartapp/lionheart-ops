/**
 * GET    /api/events/projects/[id]/compliance  — list compliance items (or defaults if ?defaults=true)
 * POST   /api/events/projects/[id]/compliance  — create compliance item
 * PUT    /api/events/projects/[id]/compliance  — update compliance item
 * DELETE /api/events/projects/[id]/compliance  — delete compliance item
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listComplianceItems,
  upsertComplianceItem,
  deleteComplianceItem,
  getDefaultComplianceChecklist,
} from '@/lib/services/eventDocumentService'

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
export const GET = withAuth(async ({ params, searchParams }) => {
  const useDefaults = searchParams.get('defaults') === 'true'

  if (useDefaults) {
    const defaults = getDefaultComplianceChecklist()
    return NextResponse.json(ok(defaults))
  }

  const items = await listComplianceItems(params.id)
  return NextResponse.json(ok(items))
}, { permission: PERMISSIONS.EVENTS_COMPLIANCE_MANAGE })

// ─── POST /api/events/projects/[id]/compliance ───────────────────────────────

/**
 * Creates a new compliance checklist item for the event.
 */
export const POST = withAuth(async ({ params, body }) => {
  const item = await upsertComplianceItem({
    eventProjectId: params.id,
    ...body,
  })
  return NextResponse.json(ok(item), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_COMPLIANCE_MANAGE, schema: CreateComplianceItemSchema })

// ─── PUT /api/events/projects/[id]/compliance ────────────────────────────────

/**
 * Updates an existing compliance checklist item.
 */
export const PUT = withAuth(async ({ params, body }) => {
  const { itemId, ...updateFields } = body
  const item = await upsertComplianceItem({
    id: itemId,
    eventProjectId: params.id,
    ...updateFields,
  })
  return NextResponse.json(ok(item))
}, { permission: PERMISSIONS.EVENTS_COMPLIANCE_MANAGE, schema: UpdateComplianceItemSchema })

// ─── DELETE /api/events/projects/[id]/compliance ─────────────────────────────

/**
 * Deletes a compliance checklist item.
 */
export const DELETE = withAuth(async ({ req, searchParams }) => {
  // Support both query param and body
  let itemId: string | null = searchParams.get('itemId')
  if (!itemId) {
    const body = await req.json()
    const validated = DeleteComplianceItemSchema.parse(body)
    itemId = validated.itemId
  }

  if (!itemId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'itemId is required'), { status: 400 })
  }

  await deleteComplianceItem(itemId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_COMPLIANCE_MANAGE })
