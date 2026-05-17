import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'
import { getFormApprovalRules, createFormApprovalRule } from '@/lib/services/approvalRuleService'
import { safeName } from '@/lib/sanitize'

/**
 * GET /api/forms/[formId]/approval-rules
 * Returns all approval workflows for this form, plus dropdown data for the builder.
 */
export const GET = withAuth(async ({ orgId, params }) => {
  const { formId } = await params
  let rules
  try {
    rules = await getFormApprovalRules(formId)
  } catch (e) {
    console.error('[approval-rules GET] getFormApprovalRules failed:', e)
    throw e
  }

  const [schools, campuses, teams, buildings] = await Promise.all([
    rawPrisma.school.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, institutionType: true, color: true },
      orderBy: { name: 'asc' },
    }),
    rawPrisma.campus.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, schoolId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    rawPrisma.team.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        members: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
          },
        },
      },
    }),
    rawPrisma.building.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const shapedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    members: t.members.map((m) => ({
      id: m.user.id,
      name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email,
      email: m.user.email,
      avatar: m.user.avatar,
    })),
  }))

  return NextResponse.json(ok({ rules, schools, campuses, buildings, teams: shapedTeams }))
}, { permission: PERMISSIONS.SETTINGS_READ })

const CreateSchema = z.object({
  name: safeName({ max: 100 }),
  module: z.enum(['EVENT', 'MAINTENANCE', 'IT']).optional(),
  description: z.string().max(500).optional(),
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
})

/**
 * POST /api/forms/[formId]/approval-rules
 * Create a new approval workflow for this form.
 */
export const POST = withAuth<z.infer<typeof CreateSchema>>(async ({ body, params }) => {
  const { formId } = await params
  await createFormApprovalRule(formId, body)
  const rules = await getFormApprovalRules(formId)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchema })
