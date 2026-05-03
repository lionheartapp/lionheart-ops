import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { getApprovalRules, createApprovalRule } from '@/lib/services/approvalRuleService'
import { safeName } from '@/lib/sanitize'

const db = prisma as unknown as OrgPrismaClient

/**
 * GET /api/settings/approval-rules
 * Returns all approval rules with their steps, plus schools/teams for the builder.
 */
export const GET = withAuth(async ({ searchParams }) => {
  const module = searchParams.get('module') || undefined
  const rules = await getApprovalRules(module)

  // Fetch shared dropdowns: schools, campuses, teams
  const [schools, campuses, teams] = await Promise.all([
    db.school.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, institutionType: true, color: true },
      orderBy: { name: 'asc' },
    }),
    db.campus.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, schoolId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.team.findMany({
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
  ])

  // Module-specific dropdowns
  const categories = module === 'MAINTENANCE'
    ? [] // Maintenance categories are hardcoded enums, not DB records
    : await db.calendarCategory.findMany({
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      })

  const buildings = module === 'MAINTENANCE'
    ? await db.building.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const shapedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    members: t.members.map((m: { user: { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null } }) => ({
      id: m.user.id,
      name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email,
      email: m.user.email,
      avatar: m.user.avatar,
    })),
  }))

  return NextResponse.json(ok({ rules, schools, campuses, categories, buildings, teams: shapedTeams }))
}, { permission: PERMISSIONS.SETTINGS_READ })

const CreateSchema = z.object({
  // LIVE-001
  name: safeName({ max: 100 }),
  module: z.enum(['EVENT', 'MAINTENANCE']).optional(),
  description: z.string().max(500).optional(),
  schoolId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  // Event conditions
  eventCategory: z.string().optional().nullable(),
  minAttendance: z.number().int().positive().optional().nullable(),
  requiresResource: z.enum(['av', 'facilities', 'custodial', 'security']).optional().nullable(),
  isOffCampus: z.boolean().optional().nullable(),
  // Maintenance conditions
  maintenanceCategory: z.string().optional().nullable(),
  maintenancePriority: z.string().optional().nullable(),
  maintenanceBuildingId: z.string().optional().nullable(),
  maintenanceMinCost: z.number().positive().optional().nullable(),
  isDefault: z.boolean().optional(),
  isFinalApprover: z.boolean().optional(),
})

/**
 * POST /api/settings/approval-rules
 * Create a new approval rule.
 */
export const POST = withAuth(async ({ body }) => {
  const rule = await createApprovalRule(body)
  const rules = await getApprovalRules(body.module)
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchema })
