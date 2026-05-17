import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addStepToRule, updateStep, removeStep, getFormApprovalRules } from '@/lib/services/approvalRuleService'

const AddStepSchema = z.object({
  teamId: z.string().min(1),
  mode: z.enum(['REQUIRED', 'NOTIFICATION']).optional(),
  trigger: z.enum(['ALWAYS', 'WHEN_RESOURCE_REQUESTED']).optional(),
  resourceType: z.string().optional().nullable(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  escalationAction: z.enum(['REMIND', 'AUTO_APPROVE', 'ESCALATE']).optional(),
  escalateToUserId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
})

/**
 * POST /api/forms/[formId]/approval-rules/[id]/steps
 * Add a step to a form workflow rule.
 */
export const POST = withAuth<z.infer<typeof AddStepSchema>>(async ({ body, params }) => {
  const { formId, id } = await params
  await addStepToRule({ ruleId: id, ...body })
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: AddStepSchema })

const UpdateStepSchema = z.object({
  stepId: z.string().min(1),
  mode: z.enum(['REQUIRED', 'NOTIFICATION']).optional(),
  trigger: z.enum(['ALWAYS', 'WHEN_RESOURCE_REQUESTED']).optional(),
  resourceType: z.string().optional().nullable(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  escalationAction: z.enum(['REMIND', 'AUTO_APPROVE', 'ESCALATE']).optional(),
  escalateToUserId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

/**
 * PUT /api/forms/[formId]/approval-rules/[id]/steps
 * Update a step within a form workflow rule.
 */
export const PUT = withAuth<z.infer<typeof UpdateStepSchema>>(async ({ body, params }) => {
  const { formId } = await params
  const { stepId, ...data } = body
  await updateStep(stepId, data)
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateStepSchema })

const DeleteStepSchema = z.object({
  stepId: z.string().min(1),
})

/**
 * DELETE /api/forms/[formId]/approval-rules/[id]/steps
 * Remove a step from a form workflow rule.
 */
export const DELETE = withAuth<z.infer<typeof DeleteStepSchema>>(async ({ body, params }) => {
  const { formId } = await params
  await removeStep(body.stepId)
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: DeleteStepSchema })
