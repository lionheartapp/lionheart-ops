import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { getApprovalRules, createApprovalRule } from '@/lib/services/approvalRuleService'

const db = prisma as unknown as OrgPrismaClient

/**
 * GET /api/settings/approval-rules
 * Returns all approval rules with their steps, plus schools/teams for the builder.
 */
export const GET = withAuth(async () => {
  const rules = await getApprovalRules()

  // Also fetch schools and teams for the builder dropdowns
  const [schools, teams] = await Promise.all([
    db.school.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, institutionType: true, color: true },
      orderBy: { name: 'asc' },
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
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    }),
  ])

  const shapedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    members: t.members.map((m: { user: { id: string; firstName: string | null; lastName: string | null; email: string } }) => ({
      id: m.user.id,
      name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email,
      email: m.user.email,
    })),
  }))

  return NextResponse.json(ok({ rules, schools, teams: shapedTeams }))
}, { permission: PERMISSIONS.SETTINGS_READ })

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schoolId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  eventCategory: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  isFinalApprover: z.boolean().optional(),
})

/**
 * POST /api/settings/approval-rules
 * Create a new approval rule.
 */
export const POST = withAuth(async ({ body }) => {
  const rule = await createApprovalRule(body)
  const rules = await getApprovalRules()
  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchema })
