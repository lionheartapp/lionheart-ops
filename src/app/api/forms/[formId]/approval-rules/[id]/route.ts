import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateApprovalRule, deleteApprovalRule, getFormApprovalRules } from '@/lib/services/approvalRuleService'
import { safeName } from '@/lib/sanitize'

const UpdateSchema = z.object({
  name: safeName({ max: 100 }).optional(),
  description: z.string().max(500).optional().nullable(),
  schoolId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  // Event conditions
  eventCategory: z.string().optional().nullable(),
  minAttendance: z.number().int().positive().optional().nullable(),
  requiresResource: z.enum(['av', 'facilities', 'custodial', 'security']).optional().nullable(),
  isOffCampus: z.boolean().optional().nullable(),
  // Maintenance/IT conditions
  maintenanceCategory: z.string().optional().nullable(),
  maintenancePriority: z.string().optional().nullable(),
  maintenanceBuildingId: z.string().optional().nullable(),
  maintenanceMinCost: z.number().positive().optional().nullable(),
  isDefault: z.boolean().optional(),
  isFinalApprover: z.boolean().optional(),
  isActive: z.boolean().optional(),
  executionMode: z.enum(['PARALLEL', 'SEQUENTIAL']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

/**
 * PATCH /api/forms/[formId]/approval-rules/[id]
 * Update a workflow rule for this form.
 */
export const PATCH = withAuth<z.infer<typeof UpdateSchema>>(async ({ body, params }) => {
  const { formId, id } = await params
  await updateApprovalRule(id, body)
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateSchema })

/**
 * DELETE /api/forms/[formId]/approval-rules/[id]
 * Delete a workflow rule from this form.
 */
export const DELETE = withAuth(async ({ params }) => {
  const { formId, id } = await params
  await deleteApprovalRule(id)
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
