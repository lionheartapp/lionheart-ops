import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateApprovalRule, deleteApprovalRule, getApprovalRules } from '@/lib/services/approvalRuleService'

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  schoolId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  eventCategory: z.string().optional().nullable(),
  minAttendance: z.number().int().positive().optional().nullable(),
  requiresResource: z.enum(['av', 'facilities', 'custodial', 'security']).optional().nullable(),
  isOffCampus: z.boolean().optional().nullable(),
  isDefault: z.boolean().optional(),
  isFinalApprover: z.boolean().optional(),
  isActive: z.boolean().optional(),
  executionMode: z.enum(['PARALLEL', 'SEQUENTIAL']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const PATCH = withAuth<z.infer<typeof UpdateSchema>>(async ({ body, params }) => {
  const { id } = await params
  await updateApprovalRule(id, body)
  const rules = await getApprovalRules()
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateSchema })

export const DELETE = withAuth(async ({ params }) => {
  const { id } = await params
  await deleteApprovalRule(id)
  const rules = await getApprovalRules()
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
